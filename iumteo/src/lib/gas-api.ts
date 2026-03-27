const GAS_API_URL = process.env.GAS_API_URL || '';
const GAS_API_KEY = process.env.GAS_API_KEY || '';

export type GasEnvelope<T = unknown> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  code?: number;
  data?: T;
};

function ensureGasConfig() {
  if (!GAS_API_URL || !GAS_API_KEY) {
    throw new Error('GAS_API_URL or GAS_API_KEY is missing.');
  }
}

export function isGasConfigured() {
  return !!(GAS_API_URL && GAS_API_KEY);
}

export async function gasGet<T>(params: URLSearchParams): Promise<T> {
  ensureGasConfig();

  // Keep both query param and header for compatibility with existing GAS deployments.
  params.set('apiKey', GAS_API_KEY);

  const response = await fetch(`${GAS_API_URL}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': GAS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`GAS API error: ${response.status} ${response.statusText}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error('Failed to parse GAS API response.');
  }
}

export async function gasPost<T>(payload: Record<string, unknown>): Promise<T> {
  ensureGasConfig();

  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': GAS_API_KEY,
    },
    body: JSON.stringify({
      apiKey: GAS_API_KEY,
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`GAS API error: ${response.status} ${response.statusText}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error('Failed to parse GAS API response.');
  }
}

export function assertGasSuccess<T>(result: GasEnvelope<T>, action: string) {
  if (result?.success === false || result?.ok === false) {
    const message = String(result?.message || `${action} failed`).trim();
    const lowered = message.toLowerCase();
    if (lowered.includes('unknown action') || lowered.includes('unsupported')) {
      throw new Error(`GAS deployment is outdated and does not support ${action}.`);
    }
    throw new Error(message);
  }

  return result;
}
