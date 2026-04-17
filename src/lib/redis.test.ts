import { describe, it, expect } from 'vitest'

describe('redis singleton', () => {
  it('exports a redis client instance', async () => {
    const { redis } = await import('@/lib/redis')
    expect(redis).toBeDefined()
    expect(typeof redis.ping).toBe('function')
  })

  it('ping resolves to PONG', async () => {
    const { redis } = await import('@/lib/redis')
    const result = await redis.ping()
    expect(result).toBe('PONG')
  })

  it('get returns null for missing key', async () => {
    const { redis } = await import('@/lib/redis')
    const result = await redis.get('nonexistent_key_xyz')
    expect(result).toBeNull()
  })
})
