import { headers } from 'next/headers'
import { redis } from '@/lib/redis'

/**
 * Best-effort client IP for unauthenticated abuse protection.
 *
 * Behind Coolify's reverse proxy the real peer address is appended to
 * `x-forwarded-for` (comma-separated). Client-supplied entries on the left are
 * spoofable, so we trust only the right-most `TRUSTED_PROXY_COUNT` hops (our own
 * proxy chain; default 1) and use the left-most of those. `x-real-ip` is used as
 * a fallback. Returns 'unknown' when neither is present so a single bucket still
 * throttles header-less callers.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  const trustedHops = Math.max(1, Number(process.env.TRUSTED_PROXY_COUNT) || 1)
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',').map(s => s.trim()).filter(Boolean)
    // The right-most `trustedHops` entries are set by our own proxy chain and
    // cannot be forged by the client; pick the left-most of those.
    const idx = Math.max(0, parts.length - trustedHops)
    if (parts[idx]) return parts[idx]
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
