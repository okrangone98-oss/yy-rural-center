/**
 * 인메모리 Rate Limiter (Redis 없이 서버 메모리 사용)
 * Next.js 서버리스 환경에서는 요청마다 인스턴스가 다를 수 있으므로
 * 완벽한 글로벌 제한은 아니지만, 기본적인 남용 방지 용도로 사용합니다.
 */

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitRecord>();

// 오래된 항목 주기적 정리 (메모리 누수 방지)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5분
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, record] of Array.from(store.entries())) {
    if (record.resetAt < now) {
      store.delete(key);
    }
  }
}

export type RateLimitOptions = {
  /** 윈도우 기간 (밀리초) */
  windowMs: number;
  /** 윈도우 내 최대 허용 횟수 */
  max: number;
};

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * @param key  구분 키 (예: `register:${ip}`, `sync:${userId}`)
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  cleanup();

  const now = Date.now();
  const record = store.get(key);

  if (!record || record.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { success: true, remaining: options.max - 1, resetAt: now + options.windowMs };
  }

  if (record.count >= options.max) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { success: true, remaining: options.max - record.count, resetAt: record.resetAt };
}

/** NextRequest에서 클라이언트 IP를 추출 */
export function getClientIp(request: Request): string {
  const headers = request instanceof Request ? request.headers : new Headers();
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
