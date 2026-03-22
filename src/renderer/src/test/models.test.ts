import { describe, expect, it } from 'vitest';
import { catalog } from '../../../shared/catalog';
import type { MeasurementBatch, QueryBuilderState, UserReferenceLocation } from '../../../shared/types';
import {
  filterCatalogHosts,
  flattenCatalogHosts,
  getAvailableCities,
  getAvailableCountries,
  getUniqueContinents,
  summarizeBatch,
} from '../lib/models';

describe('query builder helpers', () => {
  it('derives continent, country and city options in cascade', () => {
    const hosts = flattenCatalogHosts(catalog, null);
    const continents = getUniqueContinents(hosts);
    expect(continents).toContain('Europe');

    const countries = getAvailableCountries(hosts, ['Europe']);
    expect(countries).toContain('Germany');
    expect(countries).not.toContain('Japan');

    const cities = getAvailableCities(hosts, ['Germany']);
    expect(cities).toContain('Frankfurt');
  });

  it('filters hosts by geography, provider and distance', () => {
    const hosts = flattenCatalogHosts(catalog, null);
    const query: QueryBuilderState = {
      selectedContinents: ['Europe'],
      selectedCountries: ['Germany'],
      selectedCities: ['Frankfurt'],
      selectedProviderIds: ['aws', 'linode'],
      includeCustomHosts: false,
      distanceKm: 500,
    };
    const reference: UserReferenceLocation = {
      latitude: 50.1109,
      longitude: 8.6821,
      label: 'Frankfurt',
      source: 'manual',
    };

    const filtered = filterCatalogHosts(hosts, query, reference);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((host) => host.country === 'Germany')).toBe(true);
    expect(filtered.every((host) => query.selectedProviderIds.includes(host.providerId))).toBe(true);
    expect(filtered.every((host) => host.distanceKm !== null && host.distanceKm <= 500)).toBe(true);
  });
});

describe('summarizeBatch', () => {
  it('computes summary metrics', () => {
    const batch: MeasurementBatch = {
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
      settings: { rounds: 5, concurrency: 5 },
      degradedPermissions: false,
      results: [
        {
          targetId: 'a',
          targetHost: 'a',
          targetName: 'a',
          targetLocation: 'a',
          providerId: 'x',
          providerName: 'x',
          resolvedAddress: null,
          avgLatencyMs: 25,
          bestLatencyMs: 20,
          worstLatencyMs: 30,
          jitterMs: 2,
          packetLossPercent: 0,
          hopCount: 4,
          status: 'good',
          qualityScore: 90,
          hops: [],
        },
        {
          targetId: 'b',
          targetHost: 'b',
          targetName: 'b',
          targetLocation: 'b',
          providerId: 'x',
          providerName: 'x',
          resolvedAddress: null,
          avgLatencyMs: 200,
          bestLatencyMs: 180,
          worstLatencyMs: 220,
          jitterMs: 10,
          packetLossPercent: 0,
          hopCount: 10,
          status: 'bad',
          qualityScore: 30,
          hops: [],
        },
      ],
    };

    const summary = summarizeBatch(batch);
    expect(summary.best?.targetId).toBe('a');
    expect(summary.worst?.targetId).toBe('b');
    expect(Math.round(summary.average ?? 0)).toBe(113);
  });
});
