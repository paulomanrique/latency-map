import type {
  CreateShareResponse,
  CreateShareTokenResponse,
  DeleteShareRequest,
  SharePayloadV1,
} from '../shared/types';

const SHARE_API_URL = 'https://api.latencymap.net';

function getShareConfig() {
  return {
    apiUrl: SHARE_API_URL,
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

async function createShareToken(): Promise<CreateShareTokenResponse> {
  const { apiUrl } = getShareConfig();
  const response = await fetch(`${apiUrl}/api/v1/share-token`, {
    method: 'POST',
  });

  return parseJsonResponse<CreateShareTokenResponse>(response);
}

export async function createShare(payload: SharePayloadV1): Promise<CreateShareResponse> {
  const { apiUrl } = getShareConfig();
  const path = '/api/v1/shares';
  const body = JSON.stringify(payload);
  const shareToken = await createShareToken();

  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LatencyMap-Share-Token': shareToken.token,
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
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
