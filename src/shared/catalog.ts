import type { HostSeed, ProviderCatalog, ProviderId } from './types';

export interface ProviderHostRecord {
  city: string;
  country: string;
  continent: string;
  latitude: number;
  longitude: number;
  regionId?: string;
  hostname: string;
}

export interface ProviderFileRecord {
  name: string;
  website: string;
  hosts: ProviderHostRecord[];
}

const iconPool = [
  '🟡', '🔷', '🔵', '🟢', '🟠', '🔴', '🟣', '🟤', '⚪', '🩵',
  '🩷', '🩶', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '💠', '🔶',
];

function providerIcon(id: string): string {
  const hash = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return iconPool[hash % iconPool.length];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildHostSeed(
  providerId: ProviderId,
  providerName: string,
  icon: string,
  host: ProviderHostRecord
): HostSeed {
  const idSource = `${providerId}-${host.regionId || `${host.city}-${host.country}-${host.hostname}`}`;
  const location = `${host.city}, ${host.country}`;

  return {
    id: slugify(idSource),
    providerId,
    providerName,
    providerIcon: icon,
    city: host.city,
    country: host.country,
    continent: host.continent,
    latitude: host.latitude,
    longitude: host.longitude,
    location,
    regionLabel: host.regionId || host.hostname,
    hostname: host.hostname,
    search: `${host.city} ${host.country} ${host.continent} ${host.regionId ?? ''} ${host.hostname}`
      .trim()
      .toLowerCase(),
  };
}

/**
 * Build a ProviderCatalog from a map of provider files.
 * Keys should be provider IDs (e.g. 'aws', 'google-cloud').
 */
export function buildCatalog(
  providers: Record<string, ProviderFileRecord>
): ProviderCatalog {
  return {
    providers: Object.entries(providers)
      .map(([providerId, provider]) => {
        if (!providerId) return null;

        const name = provider.name?.trim() || providerId;
        const icon = providerIcon(providerId);

        return {
          id: providerId,
          name,
          icon,
          website: provider.website?.trim(),
          hosts: provider.hosts.map((host) =>
            buildHostSeed(providerId, name, icon, host)
          ),
        };
      })
      .filter(
        (provider): provider is NonNullable<typeof provider> => provider !== null
      ),
  };
}

/* ── Bundled catalog (build-time, via Vite import.meta.glob) ── */

const providerFiles = import.meta.glob('../../data/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, ProviderFileRecord>;

const bundledProviders: Record<string, ProviderFileRecord> = {};
for (const [filePath, provider] of Object.entries(providerFiles)) {
  const id = filePath.split('/').pop()?.replace('.json', '') ?? '';
  if (id) bundledProviders[id] = provider;
}

export const catalog: ProviderCatalog = buildCatalog(bundledProviders);
