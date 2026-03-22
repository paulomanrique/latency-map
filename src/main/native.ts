import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  MeasurementBatch,
  MeasurementHop,
  MeasurementProgressEvent,
  MeasurementResult,
  RunMeasurementsRequest,
} from '../shared/types';
import { writeLog } from './logger';

const execFileAsync = promisify(execFile);

interface PingSummary {
  resolvedAddress: string | null;
  avgLatencyMs: number | null;
  bestLatencyMs: number | null;
  worstLatencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number;
}

export async function runNativeMeasurements(
  request: RunMeasurementsRequest,
  signal?: AbortSignal,
  onProgress?: (event: MeasurementProgressEvent) => void
): Promise<MeasurementBatch> {
  const startedAt = new Date().toISOString();
  onProgress?.({ type: 'batch-started', startedAt });
  writeLog(
    'main',
    'info',
    `Starting measurement batch for ${request.targets.length} target(s) with ${request.settings.rounds} round(s) and concurrency ${request.settings.concurrency}.`
  );

  const results: MeasurementResult[] = [];
  const concurrency = Math.max(1, Math.min(20, request.settings.concurrency || 1));
  let cursor = 0;

  const runNext = async (): Promise<void> => {
    if (signal?.aborted) {
      return;
    }

    const index = cursor++;
    if (index >= request.targets.length) {
      return;
    }

    const target = request.targets[index];
    onProgress?.({ type: 'target-started', targetId: target.id });
    writeLog(
      'main',
      'info',
      `Starting target ${target.targetName} (${target.host}) from ${target.providerName}.`
    );

    try {
      const result = await measureTarget(target, request.settings.rounds, signal);
      results.push(result);
      onProgress?.({ type: 'target-finished', targetId: target.id, result });
      writeLog(
        'main',
        'info',
        `Finished target ${target.targetName} (${target.host}) with avg ${formatLatency(result.avgLatencyMs)}.`
      );
    } catch (error) {
      if (isAbortError(error)) {
        writeLog('main', 'warn', `Cancelled target ${target.targetName} (${target.host}).`);
        return;
      }
      const message = (error as Error).message;
      writeLog('main', 'error', `Target failed ${target.targetName} (${target.host}): ${message}`);
      const result: MeasurementResult = {
        targetId: target.id,
        targetHost: target.host,
        targetName: target.targetName,
        targetLocation: target.targetLocation,
        providerId: target.providerId,
        providerName: target.providerName,
        resolvedAddress: null,
        avgLatencyMs: null,
        bestLatencyMs: null,
        worstLatencyMs: null,
        jitterMs: null,
        packetLossPercent: 100,
        hopCount: 0,
        status: 'offline',
        qualityScore: 0,
        error: message,
        hops: [],
      };
      results.push(result);
      onProgress?.({
        type: 'target-finished',
        targetId: target.id,
        result,
      });
    }

    await runNext();
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, request.targets.length) }, () => runNext())
  );

  results.sort((left, right) => {
    const leftLatency = left.avgLatencyMs ?? Number.POSITIVE_INFINITY;
    const rightLatency = right.avgLatencyMs ?? Number.POSITIVE_INFINITY;
    if (leftLatency !== rightLatency) {
      return leftLatency - rightLatency;
    }
    return left.packetLossPercent - right.packetLossPercent;
  });

  const batch = {
    startedAt,
    completedAt: new Date().toISOString(),
    settings: request.settings,
    degradedPermissions: false,
    cancelled: signal?.aborted ?? false,
    warning: signal?.aborted ? 'Measurement run cancelled.' : undefined,
    results,
  };
  onProgress?.({
    type: 'batch-finished',
    completedAt: batch.completedAt,
    cancelled: batch.cancelled,
    warning: batch.warning,
  });
  return batch;
}

async function measureTarget(
  target: RunMeasurementsRequest['targets'][number],
  rounds: number,
  signal?: AbortSignal
): Promise<MeasurementResult> {
  writeLog('main', 'info', `Running ping for ${target.host}`);
  const ping = await runPing(target.host, rounds, signal);
  writeLog('main', 'info', `Running traceroute for ${target.host}`);
  const hops = await runTraceroute(target.host, signal);

  const status = classifyStatus(ping.avgLatencyMs);
  const qualityScore = qualityScoreFor(ping.avgLatencyMs, ping.packetLossPercent, ping.jitterMs);

  return {
    targetId: target.id,
    targetHost: target.host,
    targetName: target.targetName,
    targetLocation: target.targetLocation,
    providerId: target.providerId,
    providerName: target.providerName,
    resolvedAddress: ping.resolvedAddress,
    avgLatencyMs: ping.avgLatencyMs,
    bestLatencyMs: ping.bestLatencyMs,
    worstLatencyMs: ping.worstLatencyMs,
    jitterMs: ping.jitterMs,
    packetLossPercent: ping.packetLossPercent,
    hopCount: hops.length,
    status,
    qualityScore,
    hops,
  };
}

async function runPing(host: string, rounds: number, signal?: AbortSignal): Promise<PingSummary> {
  if (process.platform === 'win32') {
    const { stdout, stderr } = await execFileAsync('ping', ['-n', String(rounds), host], {
      timeout: 15_000,
      windowsHide: true,
      signal,
    });
    if (stderr.trim()) {
      writeLog('main', 'warn', `ping stderr for ${host}: ${stderr.trim()}`);
    }
    return parseWindowsPing(stdout);
  }

  const { stdout, stderr } = await execFileAsync(
    'ping',
    ['-c', String(rounds), '-W', '1000', '-n', host],
    {
      timeout: 15_000,
      signal,
    }
  );
  if (stderr.trim()) {
    writeLog('main', 'warn', `ping stderr for ${host}: ${stderr.trim()}`);
  }
  return parseUnixPing(stdout);
}

async function runTraceroute(host: string, signal?: AbortSignal): Promise<MeasurementHop[]> {
  if (process.platform === 'win32') {
    const { stdout, stderr } = await execFileAsync('tracert', ['-d', '-h', '30', '-w', '1000', host], {
      timeout: 95_000,
      windowsHide: true,
      signal,
    });
    if (stderr.trim()) {
      writeLog('main', 'warn', `tracert stderr for ${host}: ${stderr.trim()}`);
    }
    return parseWindowsTracert(stdout);
  }

  const tool = process.platform === 'darwin' ? 'traceroute' : 'traceroute';
  const { stdout, stderr } = await execFileAsync(
    tool,
    ['-n', '-q', '1', '-w', '1', '-m', '30', host],
    {
      timeout: 35_000,
      signal,
    }
  );
  if (stderr.trim()) {
    writeLog('main', 'warn', `traceroute stderr for ${host}: ${stderr.trim()}`);
  }
  return parseUnixTraceroute(stdout);
}

function parseUnixPing(output: string): PingSummary {
  let resolvedAddress: string | null = null;
  let packetLossPercent = 100;
  let bestLatencyMs: number | null = null;
  let avgLatencyMs: number | null = null;
  let worstLatencyMs: number | null = null;
  let jitterMs: number | null = null;

  for (const line of output.split('\n')) {
    if (line.startsWith('PING ')) {
      const match = line.match(/\(([^)]+)\)/);
      resolvedAddress = match?.[1] ?? null;
    } else if (line.includes('packet loss')) {
      const match = line.match(/([\d.]+)% packet loss/);
      packetLossPercent = match ? Number(match[1]) : 100;
    } else if (line.includes('round-trip') || line.includes('rtt min/avg/max')) {
      const stats = line.split('=').at(1)?.trim().split(' ')[0] ?? '';
      const [min, avg, max, stddev] = stats.split('/').map(Number);
      bestLatencyMs = Number.isFinite(min) ? min : null;
      avgLatencyMs = Number.isFinite(avg) ? avg : null;
      worstLatencyMs = Number.isFinite(max) ? max : null;
      jitterMs = Number.isFinite(stddev) ? stddev : null;
    }
  }

  return {
    resolvedAddress,
    avgLatencyMs,
    bestLatencyMs,
    worstLatencyMs,
    jitterMs,
    packetLossPercent,
  };
}

function parseWindowsPing(output: string): PingSummary {
  let resolvedAddress: string | null = null;
  let packetLossPercent = 100;
  let bestLatencyMs: number | null = null;
  let avgLatencyMs: number | null = null;
  let worstLatencyMs: number | null = null;

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('Pinging ')) {
      const match = line.match(/\[([^\]]+)\]/);
      resolvedAddress = match?.[1] ?? null;
    } else if (line.includes('Lost =') && line.includes('%')) {
      const match = line.match(/\((\d+)% loss\)/i);
      packetLossPercent = match ? Number(match[1]) : 100;
    } else if (line.startsWith('Minimum =')) {
      const numbers = [...line.matchAll(/=\s*(\d+)ms/g)].map((match) => Number(match[1]));
      bestLatencyMs = numbers[0] ?? null;
      worstLatencyMs = numbers[1] ?? null;
      avgLatencyMs = numbers[2] ?? null;
    }
  }

  return {
    resolvedAddress,
    avgLatencyMs,
    bestLatencyMs,
    worstLatencyMs,
    jitterMs: null,
    packetLossPercent,
  };
}

function parseUnixTraceroute(output: string): MeasurementHop[] {
  const hops: MeasurementHop[] = [];

  for (const line of output.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const hop = Number(parts[0]);
    if (!Number.isFinite(hop)) continue;

    if (parts.slice(1).every((part) => part === '*')) {
      hops.push(emptyHop(hop));
      continue;
    }

    const ipAddress = parts[1] ?? null;
    const rtts = parts.filter((part) => /^\d+(\.\d+)?$/.test(part)).map(Number);
    hops.push({
      hop,
      ipAddress,
      hostname: ipAddress,
      lastRttMs: rtts.at(-1) ?? null,
      avgRttMs: rtts.length ? rtts.reduce((sum, value) => sum + value, 0) / rtts.length : null,
      bestRttMs: rtts.length ? Math.min(...rtts) : null,
      worstRttMs: rtts.length ? Math.max(...rtts) : null,
      jitterAvgMs: null,
      lossPercent: rtts.length ? 0 : 100,
      sent: 1,
      received: rtts.length ? 1 : 0,
      timedOut: rtts.length === 0,
    });
  }

  return hops;
}

function parseWindowsTracert(output: string): MeasurementHop[] {
  const hops: MeasurementHop[] = [];

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!/^\d+/.test(line)) continue;
    const parts = line.split(/\s+/);
    const hop = Number(parts[0]);
    if (!Number.isFinite(hop)) continue;
    const ipAddress = parts.at(-1) ?? null;
    const rtts = [...line.matchAll(/(\d+)\s*ms/g)].map((match) => Number(match[1]));
    hops.push({
      hop,
      ipAddress,
      hostname: ipAddress,
      lastRttMs: rtts.at(-1) ?? null,
      avgRttMs: rtts.length ? rtts.reduce((sum, value) => sum + value, 0) / rtts.length : null,
      bestRttMs: rtts.length ? Math.min(...rtts) : null,
      worstRttMs: rtts.length ? Math.max(...rtts) : null,
      jitterAvgMs: null,
      lossPercent: rtts.length ? 0 : 100,
      sent: 1,
      received: rtts.length ? 1 : 0,
      timedOut: rtts.length === 0,
    });
  }

  return hops;
}

function emptyHop(hop: number): MeasurementHop {
  return {
    hop,
    ipAddress: null,
    hostname: null,
    lastRttMs: null,
    avgRttMs: null,
    bestRttMs: null,
    worstRttMs: null,
    jitterAvgMs: null,
    lossPercent: 100,
    sent: 1,
    received: 0,
    timedOut: true,
  };
}

function classifyStatus(avgLatencyMs: number | null): MeasurementResult['status'] {
  if (avgLatencyMs === null) return 'offline';
  if (avgLatencyMs < 50) return 'good';
  if (avgLatencyMs < 150) return 'medium';
  return 'bad';
}

function qualityScoreFor(
  avgLatencyMs: number | null,
  packetLossPercent: number,
  jitterMs: number | null
): number {
  if (avgLatencyMs === null) return 0;
  const latencyScore = Math.max(0, 100 - avgLatencyMs / 2);
  const lossPenalty = packetLossPercent * 2;
  const jitterPenalty = (jitterMs ?? 0) / 2;
  return Math.max(0, Math.min(100, latencyScore - lossPenalty - jitterPenalty));
}

function formatLatency(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}ms`;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message.includes('The operation was aborted') ||
      error.message.includes('The operation was canceled'))
  );
}
