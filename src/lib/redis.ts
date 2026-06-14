import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis }

// Redis backs security-relevant controls (rate limits, the cron idempotency
// lock, TOTP handoff tokens). Silently falling back to localhost in production
// would make those controls operate against the wrong/empty store, so require
// REDIS_URL there rather than guessing.
if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
  throw new Error('REDIS_URL must be set in production')
}

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
