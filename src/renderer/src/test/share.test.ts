import { describe, expect, it } from 'vitest';
import type {
  MeasurementBatch,
  QueryBuilderState,
  ShareViewSnapshot,
  UserReferenceLocation,
} from '../../../shared/types';
import { buildSharePayload } from '../lib/share';
import type { DisplayHost } from '../lib/models';

const baseBatch: MeasurementBatch = {
  startedAt: '2026-01-01T00:00:00Z',
  completedAt: '2026-01-01T00:01:00Z',
  settings: { rounds: 5, concurrency: 5 },
  degradedPermissions: false,
  results: [
    {
      targetId: 'catalog-1',
      targetHost: 'fra.example.com',
      targetName: 'eu-central-1',
      targetLocation: 'Frankfurt, Germany',
      providerId: 'aws',
      providerName: 'AWS',
      resolvedAddress: '203.0.113.10',
      avgLatencyMs: 22,
      bestLatencyMs: 20,
      worstLatencyMs: 25,
      jitterMs: 2,
      packetLossPercent: 0,
      hopCount: 6,
      status: 'good',
      qualityScore: 92,
      hops: [],
    },
    {
      targetId: 'custom-1',
      targetHost: 'intranet.example.local',
      targetName: 'Office',
      targetLocation: 'Madrid, Spain',
      providerId: 'custom',
      providerName: 'Custom Hosts',
      resolvedAddress: '10.0.0.10',
      avgLatencyMs: 85,
      bestLatencyMs: 82,
      worstLatencyMs: 91,
      jitterMs: 4,
      packetLossPercent: 0,
      hopCount: 9,
      status: 'medium',
      qualityScore: 64,
      hops: [],
    },
  ],
};

const query: QueryBuilderState = {
  selectedContinents: ['Europe'],
  selectedCountries: ['Germany'],
  selectedCities: ['Frankfurt'],
  selectedProviderIds: ['aws'],
  includeCustomHosts: false,
  distanceKm: null,
};

const view: ShareViewSnapshot = {
  mode: 'provider',
  activeProviderId: 'aws',
  activeProviderName: 'AWS',
  locationMode: 'locations',
  search: 'fra',
  sort: {
    key: 'latency',
    dir: 'asc',
  },
};

const referenceLocation: UserReferenceLocation = {
  latitude: 40.4168,
  longitude: -3.7038,
  label: 'Madrid',
  source: 'manual',
};

function makeHost(overrides: Partial<DisplayHost>): DisplayHost {
  return {
    id: 'catalog-1',
    kind: 'catalog',
    providerId: 'aws',
    providerName: 'AWS',
    providerIcon: '🟡',
    city: 'Frankfurt',
    country: 'Germany',
    continent: 'Europe',
    latitude: 50.1109,
    longitude: 8.6821,
    location: 'Frankfurt, Germany',
    regionLabel: 'eu-central-1',
    hostname: 'fra.example.com',
    search: 'fra',
    distanceKm: 1447,
    result: baseBatch.results[0],
    ...overrides,
  };
}

describe('buildSharePayload', () => {
  it('includes only visible hosts and filters batch results to the shared view', () => {
    const payload = buildSharePayload({
      appVersion: '0.0.1',
      query,
      settings: baseBatch.settings,
      batch: baseBatch,
      view,
      referenceLocation,
      hosts: [makeHost({ id: 'catalog-1', result: baseBatch.results[0] })],
    });

    expect(payload.hosts).toHaveLength(1);
    expect(payload.batch.results).toHaveLength(1);
    expect(payload.batch.results[0]?.targetId).toBe('catalog-1');
    expect(payload.containsCustomHosts).toBe(false);
    expect(payload.referenceLabel).toBe('Madrid');
    expect(payload.referenceSource).toBe('manual');
    expect(JSON.stringify(payload)).not.toContain('"latitude":40.4168');
    expect(JSON.stringify(payload)).not.toContain('"longitude":-3.7038');
  });

  it('flags custom hosts in the payload', () => {
    const payload = buildSharePayload({
      appVersion: '0.0.1',
      query: { ...query, includeCustomHosts: true },
      settings: baseBatch.settings,
      batch: baseBatch,
      view: { ...view, mode: 'custom', activeProviderId: null, activeProviderName: null },
      referenceLocation,
      hosts: [
        makeHost({
          id: 'custom-1',
          kind: 'custom',
          providerId: 'custom',
          providerName: 'Custom Hosts',
          city: 'Madrid',
          country: 'Custom',
          continent: 'Custom',
          location: 'Madrid, Spain',
          regionLabel: 'Office',
          hostname: 'intranet.example.local',
          distanceKm: null,
          result: baseBatch.results[1],
        }),
      ],
    });

    expect(payload.containsCustomHosts).toBe(true);
    expect(payload.summary.hostCount).toBe(1);
    expect(payload.summary.mediumCount).toBe(1);
  });
});
