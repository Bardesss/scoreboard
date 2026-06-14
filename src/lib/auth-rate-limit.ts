import { headers } from 'next/headers'
import { redis } from '@/lib/redis'

/**
 * Best-effort client IP for unauthenticated abuse protection.
 *
 * Behind Coolify's reverse proxy the real client address arrives in
 * `x-forwarded-for` (comma-separated; the first entry is the original client).
 * `x-real-ip` is used as a fallback. Returns 'unknown' when neither is present
 * so a single bucket still throttles header-less callers.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return h.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Fixed-window IP rate limit backed by Redis. Returns `true` when the request
 * is allowed, `false` once the limit for the current window is exceeded.
 *
 * Fail-open: if Redis is unreachable we allow the request rather than locking
 * everyone out of auth.
 */
export async function checkIpRateLimit(
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const ip = await getClientIp()
    const key = `iprl:${action}:${ip}`
    const hits = await redis.incr(key)
    if (hits === 1) await redis.expire(key, windowSeconds)
    return hits <= limit
  } catch {
    return true
  }
}
