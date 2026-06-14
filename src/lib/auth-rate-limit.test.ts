import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHeaders = { get: vi.fn() }
vi.mock('next/headers', () => ({ headers: vi.fn(async () => mockHeaders) }))

vi.mock('@/lib/redis', () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn().mockResolvedValue(1),
  },
}))

describe('getClientIp', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('uses the proxy-trusted (right-most) x-forwarded-for entry', async () => {
    mockHeaders.get.mockImplementation((h: string) =>
      h === 'x-forwarded-for' ? '1.1.1.1, 2.2.2.2, 3.3.3.3' : null)
    const { getClientIp } = await import('./auth-rate-limit')
    // default TRUSTED_PROXY_COUNT = 1 → last hop (3.3.3.3) is the one our proxy set
    expect(await getClientIp()).toBe('3.3.3.3')
  })

  it('falls back to x-real-ip', async () => {
    mockHeaders.get.mockImplementation((h: string) =>
      h === 'x-real-ip' ? '198.51.100.4' : null)
    const { getClientIp } = await import('./auth-rate-limit')
    expect(await getClientIp()).toBe('198.51.100.4')
  })

  it('returns "unknown" when no headers present', async () => {
    mockHeaders.get.mockReturnValue(null)
    const { getClientIp } = await import('./auth-rate-limit')
    expect(await getClientIp()).toBe('unknown')
  })
})

describe('checkIpRateLimit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('allows when under the limit and sets TTL on first hit', async () => {
    mockHeaders.get.mockReturnValue('203.0.113.7')
    const { redis } = await import('@/lib/redis')
    vi.mocked(redis.incr).mockResolvedValue(1)

    const { checkIpRateLimit } = await import('./auth-rate-limit')
    expect(await checkIpRateLimit('register', 5, 3600)).toBe(true)
    expect(redis.expire).toHaveBeenCalledWith('iprl:register:203.0.113.7', 3600)
  })

  it('does not reset TTL on subsequent hits', async () => {
    mockHeaders.get.mockReturnValue('203.0.113.7')
    const { redis } = await import('@/lib/redis')
    vi.mocked(redis.incr).mockResolvedValue(3)

    const { checkIpRateLimit } = await import('./auth-rate-limit')
    expect(await checkIpRateLimit('register', 5, 3600)).toBe(true)
    expect(redis.expire).not.toHaveBeenCalled()
  })

  it('blocks once the limit is exceeded', async () => {
    mockHeaders.get.mockReturnValue('203.0.113.7')
    const { redis } = await import('@/lib/redis')
    vi.mocked(redis.incr).mockResolvedValue(6)

    const { checkIpRateLimit } = await import('./auth-rate-limit')
    expect(await checkIpRateLimit('register', 5, 3600)).toBe(false)
  })

  it('fails open when Redis throws', async () => {
    mockHeaders.get.mockReturnValue('203.0.113.7')
    const { redis } = await import('@/lib/redis')
    vi.mocked(redis.incr).mockRejectedValue(new Error('redis down'))

    const { checkIpRateLimit } = await import('./auth-rate-limit')
    expect(await checkIpRateLimit('register', 5, 3600)).toBe(true)
  })
})
