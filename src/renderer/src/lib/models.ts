import type {
  CustomHost,
  HostSeed,
  MeasurementBatch,
  MeasurementResult,
  ProviderCatalog,
  ProviderId,
  QueryBuilderState,
  UserReferenceLocation,
} from '../../../shared/types';

export interface DisplayHost extends HostSeed {
  kind: 'catalog' | 'custom';
  result: MeasurementResult | null;
  distanceKm: number | null;
}

export function classifyStatus(latencyMs: number | null): MeasurementResult['status'] {
  if (latencyMs === null) return 'offline';
  if (latencyMs < 50) return 'good';
  if (latencyMs < 150) return 'medium';
  return 'bad';
}

export function getQualityScore(
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

function getResultMap(batch: MeasurementBatch | null): Map<string, MeasurementResult> {
  return new Map(batch?.results.map((result) => [result.targetId, result]) ?? []);
}

export function flattenCatalogHosts(
  catalog: ProviderCatalog,
  batch: MeasurementBatch | null
): DisplayHost[] {
  const results = getResultMap(batch);
  return catalog.providers.flatMap((provider) =>
    provider.hosts.map((host) => ({
      ...host,
      kind: 'catalog' as const,
      result: results.get(host.id) ?? null,
      distanceKm: null,
    }))
  );
}

export function buildCustomDisplayHosts(
  customHosts: CustomHost[],
  batch: MeasurementBatch | null
): DisplayHost[] {
  const results = getResultMap(batch);
  return customHosts
    .filter((host) => host.enabled)
    .map((host) => ({
      id: host.id,
      providerId: 'custom' as ProviderId,
      providerName: 'Custom Hosts',
      providerIcon: '✦',
      city: host.location || 'Custom Location',
      country: 'Custom',
      continent: 'Custom',
      latitude: null,
      longitude: null,
      location: host.location || 'Custom Location',
      regionLabel: host.name,
      hostname: host.host,
      search: `${host.name} ${host.location} ${host.host}`.trim().toLowerCase(),
      kind: 'custom' as const,
      result: results.get(host.id) ?? null,
      distanceKm: null,
    }));
}

export type SortKey = 'latency' | 'distance' | 'hops';
export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: SortKey;
  dir: SortDir;
}

function nameFallback(a: DisplayHost, b: DisplayHost): number {
  return `${a.providerName}-${a.city}-${a.hostname}`.localeCompare(
    `${b.providerName}-${b.city}-${b.hostname}`
  );
}

export function sortDisplayHosts(a: DisplayHost, b: DisplayHost): number {
  return makeSortComparator({ key: 'latency', dir: 'asc' })(a, b);
}

export function makeSortComparator(sort: SortState): (a: DisplayHost, b: DisplayHost) => number {
  const sign = sort.dir === 'asc' ? 1 : -1;

  return (a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sort.key) {
      case 'latency':
        aVal = a.result?.avgLatencyMs ?? Number.POSITIVE_INFINITY;
        bVal = b.result?.avgLatencyMs ?? Number.POSITIVE_INFINITY;
        break;
      case 'distance':
        aVal = a.distanceKm ?? Number.POSITIVE_INFINITY;
        bVal = b.distanceKm ?? Number.POSITIVE_INFINITY;
        break;
      case 'hops':
        aVal = a.result?.hopCount ?? Number.POSITIVE_INFINITY;
        bVal = b.result?.hopCount ?? Number.POSITIVE_INFINITY;
        break;
    }

    if (aVal !== bVal) {
      return (aVal - bVal) * sign;
    }

    return nameFallback(a, b);
  };
}

export function searchMatch(host: DisplayHost, query: string): boolean {
  if (!query.trim()) return true;
  return host.search.includes(query.trim().toLowerCase());
}

export function summarizeBatch(batch: MeasurementBatch | null): {
  best: MeasurementResult | null;
  worst: MeasurementResult | null;
  average: number | null;
  goodCount: number;
  mediumCount: number;
  badCount: number;
} {
  if (!batch?.results.length) {
    return {
      best: null,
      worst: null,
      average: null,
      goodCount: 0,
      mediumCount: 0,
      badCount: 0,
    };
  }

  const online = batch.results.filter((result) => result.avgLatencyMs !== null);
  const sorted = [...online].sort((a, b) => (a.avgLatencyMs ?? 0) - (b.avgLatencyMs ?? 0));
  const average =
    online.length > 0
      ? online.reduce((sum, result) => sum + (result.avgLatencyMs ?? 0), 0) / online.length
      : null;

  return {
    best: sorted[0] ?? null,
    worst: sorted.at(-1) ?? null,
    average,
    goodCount: batch.results.filter((result) => result.status === 'good').length,
    mediumCount: batch.results.filter((result) => result.status === 'medium').length,
    badCount: batch.results.filter(
      (result) => result.status === 'bad' || result.status === 'offline'
    ).length,
  };
}

export function getUniqueContinents(hosts: DisplayHost[]): string[] {
  return [...new Set(hosts.map((host) => host.continent))].sort();
}

export function getAvailableCountries(hosts: DisplayHost[], continents: string[]): string[] {
  if (continents.length === 0) return [];
  return [
    ...new Set(
      hosts
        .filter((host) => continents.includes(host.continent))
        .map((host) => host.country)
    ),
  ].sort();
}

export function getAvailableCities(hosts: DisplayHost[], countries: string[]): string[] {
  if (countries.length === 0) return [];
  return [
    ...new Set(
      hosts
        .filter((host) => countries.includes(host.country))
        .map((host) => host.city)
    ),
  ].sort();
}

export function haversineKm(
  origin: Pick<UserReferenceLocation, 'latitude' | 'longitude'>,
  target: Pick<HostSeed, 'latitude' | 'longitude'>
): number | null {
  if (target.latitude === null || target.longitude === null) {
    return null;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(target.latitude - origin.latitude);
  const dLon = toRadians(target.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(target.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function filterCatalogHosts(
  hosts: DisplayHost[],
  query: QueryBuilderState,
  referenceLocation: UserReferenceLocation | null
): DisplayHost[] {
  return hosts
    .filter((host) =>
      query.selectedProviderIds.length > 0 ? query.selectedProviderIds.includes(host.providerId) : false
    )
    .filter((host) =>
      query.selectedContinents.length > 0 ? query.selectedContinents.includes(host.continent) : true
    )
    .filter((host) =>
      query.selectedCountries.length > 0 ? query.selectedCountries.includes(host.country) : true
    )
    .filter((host) =>
      query.selectedCities.length > 0 ? query.selectedCities.includes(host.city) : true
    )
    .map((host) => ({
      ...host,
      distanceKm: referenceLocation ? haversineKm(referenceLocation, host) : null,
    }))
    .filter((host) =>
      query.distanceKm !== null && referenceLocation
        ? host.distanceKm !== null && host.distanceKm <= query.distanceKm
        : true
    );
}
