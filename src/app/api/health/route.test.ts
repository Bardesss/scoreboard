import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'

describe('GET /api/health', () => {
  it('returns 200 with db:ok and redis:ok when both are healthy', async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ db: 'ok', redis: 'ok' })
  })

  it('returns 503 when db throws', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB down'))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.db).toBe('error')
    expect(body.redis).toBe('ok')
  })

  it('returns 503 when redis throws', async () => {
    const { redis } = await import('@/lib/redis')
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error('Redis down'))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.db).toBe('ok')
    expect(body.redis).toBe('error')
  })
})
