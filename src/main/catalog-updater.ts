import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCatalog, type ProviderFileRecord } from '../shared/catalog';
import type { ProviderCatalog } from '../shared/types';
import { writeLog } from './logger';

const GITHUB_API_BASE =
  'https://api.github.com/repos/paulomanrique/latency-map/contents/data';
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/paulomanrique/latency-map/master/data';

function dataDir(): string {
  return path.join(app.getPath('userData'), 'data');
}

/**
 * Read all provider JSON files from the local data cache.
 * Returns null if the cache directory doesn't exist or is empty.
 */
export async function loadCachedCatalog(): Promise<ProviderCatalog | null> {
  const dir = dataDir();

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  if (jsonFiles.length === 0) return null;

  const providers: Record<string, ProviderFileRecord> = {};

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf8');
      const parsed = JSON.parse(raw) as ProviderFileRecord;
      if (parsed.hosts && Array.isArray(parsed.hosts)) {
        providers[file.replace('.json', '')] = parsed;
      }
    } catch {
      writeLog('main', 'warn', `Skipping invalid cached provider file: ${file}`);
    }
  }

  if (Object.keys(providers).length === 0) return null;

  writeLog('main', 'info', `Loaded ${Object.keys(providers).length} providers from cache.`);
  return buildCatalog(providers);
}

interface GitHubContentEntry {
  name: string;
  download_url: string | null;
}

/**
 * Fetch the latest provider JSON files from GitHub and save to local cache.
 * Returns the built catalog, or null on failure.
 */
export async function fetchRemoteCatalog(): Promise<ProviderCatalog | null> {
  const dir = dataDir();

  try {
    writeLog('main', 'info', 'Fetching provider catalog from GitHub...');

    const listRes = await fetch(GITHUB_API_BASE, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!listRes.ok) {
      writeLog('main', 'warn', `GitHub API responded ${listRes.status}, falling back to raw download.`);
      return await fetchRawFallback(dir);
    }

    const entries = (await listRes.json()) as GitHubContentEntry[];
    const jsonEntries = entries.filter(
      (e) => e.name.endsWith('.json') && e.download_url
    );

    if (jsonEntries.length === 0) {
      writeLog('main', 'warn', 'No JSON files found in GitHub data directory.');
      return null;
    }

    await fs.mkdir(dir, { recursive: true });

    const providers: Record<string, ProviderFileRecord> = {};

    const results = await Promise.allSettled(
      jsonEntries.map(async (entry) => {
        const res = await fetch(entry.download_url!);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${entry.name}`);
        const text = await res.text();
        const parsed = JSON.parse(text) as ProviderFileRecord;
        if (!parsed.hosts || !Array.isArray(parsed.hosts)) {
          throw new Error(`Invalid provider file: ${entry.name}`);
        }
        await fs.writeFile(path.join(dir, entry.name), text, 'utf8');
        const id = entry.name.replace('.json', '');
        providers[id] = parsed;
      })
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      writeLog(
        'main',
        'warn',
        `${failed.length} provider file(s) failed to download.`
      );
    }

    if (Object.keys(providers).length === 0) return null;

    writeLog(
      'main',
      'info',
      `Updated ${Object.keys(providers).length} providers from GitHub.`
    );
    return buildCatalog(providers);
  } catch (error) {
    writeLog(
      'main',
      'error',
      `Failed to fetch catalog from GitHub: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Fallback: fetch known provider files directly from raw.githubusercontent.com
 * when the GitHub API is rate-limited.
 */
async function fetchRawFallback(
  dir: string
): Promise<ProviderCatalog | null> {
  // We keep a known list as fallback — the API path is preferred.
  const knownFiles = await getKnownFilesFromCache(dir);
  if (knownFiles.length === 0) {
    writeLog('main', 'warn', 'No known provider files for raw fallback.');
    return null;
  }

  await fs.mkdir(dir, { recursive: true });

  const providers: Record<string, ProviderFileRecord> = {};

  const results = await Promise.allSettled(
    knownFiles.map(async (fileName) => {
      const url = `${GITHUB_RAW_BASE}/${fileName}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${fileName}`);
      const text = await res.text();
      const parsed = JSON.parse(text) as ProviderFileRecord;
      if (!parsed.hosts || !Array.isArray(parsed.hosts)) {
        throw new Error(`Invalid provider file: ${fileName}`);
      }
      await fs.writeFile(path.join(dir, fileName), text, 'utf8');
      const id = fileName.replace('.json', '');
      providers[id] = parsed;
    })
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    writeLog('main', 'warn', `Raw fallback: ${failed.length} file(s) failed.`);
  }

  if (Object.keys(providers).length === 0) return null;

  writeLog(
    'main',
    'info',
    `Updated ${Object.keys(providers).length} providers via raw fallback.`
  );
  return buildCatalog(providers);
}

async function getKnownFilesFromCache(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}
