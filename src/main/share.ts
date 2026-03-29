import { createHash, createHmac } from 'node:crypto';
import type {
  CreateShareResponse,
  DeleteShareRequest,
  SharePayloadV1,
} from '../shared/types';

const SHARE_API_URL = 'https://api.latencymap.net';
const SHARE_KEY_ID = 'desktop-v1';
const SHARE_SECRET = '65b1bb3925edc6a5a02464b9b99e8abcf19cf83ba71101f0c6670cbaf73ac560';

function getShareConfig() {
  return {
    apiUrl: SHARE_API_URL,
    keyId: SHARE_KEY_ID,
    secret: SHARE_SECRET,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function signRequest(
  method: 'POST' | 'DELETE',
  path: string,
  timestamp: string,
  body: string,
  secret: string
): string {
  const canonical = [method, path, timestamp, sha256(body)].join('\n');
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

function buildSignedHeaders(
  method: 'POST' | 'DELETE',
  path: string,
  body: string
): HeadersInit {
  const { keyId, secret } = getShareConfig();
  const timestamp = new Date().toISOString();
  const signature = signRequest(method, path, timestamp, body, secret);

  return {
    'Content-Type': 'application/json',
    'X-LatencyMap-Key-Id': keyId,
    'X-LatencyMap-Timestamp': timestamp,
    'X-LatencyMap-Signature': signature,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : null;
  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : `Share request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}

export async function createShare(payload: SharePayloadV1): Promise<CreateShareResponse> {
  const { apiUrl } = getShareConfig();
  const path = '/api/v1/shares';
  const body = JSON.stringify(payload);

  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: buildSignedHeaders('POST', path, body),
    body,
  });

  return parseJsonResponse<CreateShareResponse>(response);
}

export async function deleteShare(request: DeleteShareRequest): Promise<void> {
  const { apiUrl } = getShareConfig();
  const path = `/api/v1/shares/${encodeURIComponent(request.publicId)}`;
  const body = JSON.stringify({ deleteToken: request.deleteToken });

  const response = await fetch(`${apiUrl}${path}`, {
    method: 'DELETE',
    headers: buildSignedHeaders('DELETE', path, body),
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Delete share failed with status ${response.status}.`;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
}
