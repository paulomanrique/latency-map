import type { UserReferenceLocation } from '../../../shared/types';

interface IpLookupResponse {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
}

interface IpApiResponse {
  status?: string;
  lat?: number;
  lon?: number;
  city?: string;
  country?: string;
  message?: string;
}

export async function requestBrowserLocation(): Promise<UserReferenceLocation> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 60_000,
    });
  });

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  return {
    latitude,
    longitude,
    label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    source: 'device',
  };
}

async function fetchJson(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6_000);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function lookupIpApi(): Promise<UserReferenceLocation> {
  const response = await fetchJson('http://ip-api.com/json/');
  if (!response.ok) {
    throw new Error(`ip-api failed with ${response.status}`);
  }

  const data = (await response.json()) as IpApiResponse;
  if (data.status !== 'success' || typeof data.lat !== 'number' || typeof data.lon !== 'number') {
    throw new Error(data.message ? `ip-api: ${data.message}` : 'ip-api returned no coordinates');
  }

  const label = [data.city, data.country].filter(Boolean).join(', ') || 'Approximate location';

  return {
    latitude: data.lat,
    longitude: data.lon,
    label,
    source: 'ip',
  };
}

async function lookupIpWho(): Promise<UserReferenceLocation> {
  const response = await fetchJson('https://ipwho.is/');
  if (!response.ok) {
    throw new Error(`ipwho.is failed with ${response.status}`);
  }

  const data = (await response.json()) as IpLookupResponse;
  if (
    data.success === false ||
    typeof data.latitude !== 'number' ||
    typeof data.longitude !== 'number'
  ) {
    throw new Error('ipwho.is returned no coordinates');
  }

  const label = [data.city, data.country].filter(Boolean).join(', ') || 'Approximate location';

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    label,
    source: 'ip',
  };
}

export async function requestIpLocation(): Promise<UserReferenceLocation> {
  const providers = [lookupIpApi, lookupIpWho];
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      return await provider();
    } catch (error) {
      failures.push((error as Error).message);
    }
  }

  throw new Error(`IP lookup unavailable: ${failures.join(' | ')}`);
}
