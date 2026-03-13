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

export async function gasGet<T>(params: URLSearchParams): Promise<T> {
  ensureGasConfig();
  params.set('apiKey', GAS_API_KEY);
  const response = await fetch(`${GAS_API_URL}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
  });
  return response.json();
}

export async function gasPost<T>(payload: Record<string, unknown>): Promise<T> {
  ensureGasConfig();
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: GAS_API_KEY,
      ...payload,
    }),
  });
  return response.json();
}

export function assertGasSuccess<T>(result: GasEnvelope<T>, action: string) {
  if (result?.success === false || result?.ok === false) {
    const message = String(result?.message || `${action} failed`).trim();
    const lowered = message.toLowerCase();
    if (lowered.includes('unknown action') || lowered.includes('unsupported')) {
      throw new Error(`GAS 배포 코드가 최신이 아닙니다. ${action} 액션을 지원하지 않습니다.`);
    }
    throw new Error(message);
  }

  return result;
}
