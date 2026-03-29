import type {
  AppSettings,
  MeasurementBatch,
  ProviderCatalog,
  QueryBuilderState,
  ShareHostSnapshot,
  SharePayloadV1,
  ShareSummarySnapshot,
  ShareViewSnapshot,
  UserReferenceLocation,
} from '../../../shared/types';
import type { DisplayHost } from './models';

interface BuildShareSnapshotInput {
  appVersion: string;
  query: QueryBuilderState;
  settings: AppSettings;
  batch: MeasurementBatch;
  view: ShareViewSnapshot;
  referenceLocation: UserReferenceLocation | null;
  hosts: DisplayHost[];
}

function toShareHost(host: DisplayHost): ShareHostSnapshot {
  return {
    id: host.id,
    kind: host.kind,
    providerId: host.providerId,
    providerName: host.providerName,
    providerIcon: host.providerIcon,
    city: host.city,
    country: host.country,
    continent: host.continent,
    location: host.location,
    regionLabel: host.regionLabel,
    hostname: host.hostname,
    distanceKm: host.distanceKm,
    result: host.result,
  };
}

function summarizeHosts(hosts: ShareHostSnapshot[]): ShareSummarySnapshot {
  const results = hosts.map((host) => host.result).filter((result) => result !== null);
  const online = results.filter((result) => result.avgLatencyMs !== null);
  const sorted = [...online].sort((a, b) => (a.avgLatencyMs ?? 0) - (b.avgLatencyMs ?? 0));
  const averageLatencyMs =
    online.length > 0
      ? online.reduce((sum, result) => sum + (result.avgLatencyMs ?? 0), 0) / online.length
      : null;

  return {
    bestTargetId: sorted[0]?.targetId ?? null,
    worstTargetId: sorted.at(-1)?.targetId ?? null,
    averageLatencyMs,
    goodCount: results.filter((result) => result.status === 'good').length,
    mediumCount: results.filter((result) => result.status === 'medium').length,
    badCount: results.filter((result) => result.status === 'bad' || result.status === 'offline').length,
    hostCount: hosts.length,
  };
}

export function buildSharePayload({
  appVersion,
  query,
  settings,
  batch,
  view,
  referenceLocation,
  hosts,
}: BuildShareSnapshotInput): SharePayloadV1 {
  const shareHosts = hosts.map(toShareHost);
  const visibleTargetIds = new Set(shareHosts.map((host) => host.id));
  const filteredBatch: MeasurementBatch = {
    ...batch,
    results: batch.results.filter((result) => visibleTargetIds.has(result.targetId)),
  };

  return {
    schemaVersion: 1,
    appVersion,
    createdAt: new Date().toISOString(),
    query,
    settings,
    batch: filteredBatch,
    view,
    referenceLabel: referenceLocation?.label ?? null,
    referenceSource: referenceLocation?.source ?? null,
    containsCustomHosts: shareHosts.some((host) => host.kind === 'custom'),
    hosts: shareHosts,
    summary: summarizeHosts(shareHosts),
  };
}

export function getActiveProviderName(
  catalog: ProviderCatalog | null,
  providerId: string | null
): string | null {
  if (!catalog || !providerId) {
    return null;
  }
  return catalog.providers.find((provider) => provider.id === providerId)?.name ?? null;
}
