import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Helper: set the four required vars (+ optional internal URL when given).
function configure(internal?: string) {
  process.env.UMAMI_URL = 'https://analytics.example.com'
  process.env.UMAMI_WEBSITE_ID = 'web-123'
  process.env.UMAMI_USERNAME = 'admin'
  process.env.UMAMI_PASSWORD = 'secret'
  if (internal) process.env.UMAMI_INTERNAL_URL = internal
  else delete process.env.UMAMI_INTERNAL_URL
}

function unconfigure() {
  delete process.env.UMAMI_URL
  delete process.env.UMAMI_INTERNAL_URL
  delete process.env.UMAMI_WEBSITE_ID
  delete process.env.UMAMI_USERNAME
  delete process.env.UMAMI_PASSWORD
}

// Build a fetch mock that routes by URL substring. Each entry is a function
// returning a Response-like object.
function mockFetch(routes: Record<string, () => unknown>) {
  return vi.fn(async (input: string, _init?: RequestInit) => {
    for (const [needle, make] of Object.entries(routes)) {
      if (input.includes(needle)) {
        const body = make()
        return {
          ok: true,
          status: 200,
          json: async () => body,
        } as unknown as Response
      }
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response
  })
}

beforeEach(() => {
  vi.resetModules() // clears module-level token/breaker cache between tests
  configure()
})

afterEach(() => {
  vi.unstubAllGlobals()
  unconfigure()
})

describe('umamiConfigured / apiBase', () => {
  it('is false when a required var is missing', async () => {
    delete process.env.UMAMI_PASSWORD
    const umami = await import('./umami')
    expect(umami.umamiConfigured()).toBe(false)
  })

  it('is true when all required vars are present', async () => {
    const umami = await import('./umami')
    expect(umami.umamiConfigured()).toBe(true)
  })

  it('apiBase prefers UMAMI_INTERNAL_URL, falls back to UMAMI_URL', async () => {
    configure('http://umami-internal:3000')
    const umami = await import('./umami')
    expect(umami.apiBase()).toBe('http://umami-internal:3000')
    delete process.env.UMAMI_INTERNAL_URL
    expect(umami.apiBase()).toBe('https://analytics.example.com')
  })
})

describe('parseStats', () => {
  it('parses the nested shape', async () => {
    const { parseStats } = await import('./umami')
    const s = parseStats({
      pageviews: { value: 100, prev: 80 },
      visitors: { value: 40, prev: 30 },
      visits: { value: 50, prev: 45 },
      bounces: { value: 25, prev: 20 },
      totaltime: { value: 5000, prev: 4000 },
    })
    expect(s.pageviews).toBe(100)
    expect(s.visitors).toBe(40)
    expect(s.prev.pageviews).toBe(80)
    expect(s.prev.visitors).toBe(30)
    expect(s.bounceRate).toBe(50) // 25/50*100
    expect(s.avgVisitTime).toBe(100) // 5000/50
  })

  it('parses the flat shape with a comparison block', async () => {
    const { parseStats } = await import('./umami')
    const s = parseStats({
      pageviews: 100, visitors: 40, visits: 50, bounces: 25, totaltime: 5000,
      comparison: { pageviews: 80, visitors: 30 },
    })
    expect(s.pageviews).toBe(100)
    expect(s.prev.pageviews).toBe(80)
    expect(s.prev.visitors).toBe(30)
  })

  it('guards divide-by-zero', async () => {
    const { parseStats } = await import('./umami')
    const s = parseStats({ pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 })
    expect(s.bounceRate).toBe(0)
    expect(s.avgVisitTime).toBe(0)
  })
})

describe('normalizeSeries', () => {
  it('gap-fills missing days and maps sessions, oldest-first', async () => {
    const { normalizeSeries } = await import('./umami')
    const endSec = Date.UTC(2026, 5, 15) / 1000 // 2026-06-15 UTC midnight
    const out = normalizeSeries(
      [{ x: '2026-06-14', y: 10 }],
      [{ x: '2026-06-15', y: 3 }],
      3,
      endSec,
    )
    expect(out).toEqual([
      { date: '2026-06-13', views: 0, sessions: 0 },
      { date: '2026-06-14', views: 10, sessions: 0 },
      { date: '2026-06-15', views: 0, sessions: 3 },
    ])
  })
})

describe('getSummary (network)', () => {
  it('logs in once, then fetches stats with a bearer token', async () => {
    const fetchMock = mockFetch({
      '/api/auth/login': () => ({ token: 'tok-1' }),
      '/stats': () => ({ pageviews: 10, visitors: 5, visits: 6, bounces: 3, totaltime: 600 }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const umami = await import('./umami')

    const s1 = await umami.getSummary(30)
    expect(s1?.pageviews).toBe(10)

    // Second call reuses the cached token → no second login.
    await umami.getSummary(30)
    const loginCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/auth/login'))
    expect(loginCalls.length).toBe(1)

    // The stats request carried the bearer token.
    const statsCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/stats'))!
    const headers = (statsCall[1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-1')
  })

  it('re-logs in once on a 401 and retries', async () => {
    let statsHits = 0
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes('/api/auth/login')) {
        return { ok: true, status: 200, json: async () => ({ token: 'tok' }) } as unknown as Response
      }
      // First stats hit → 401, second → ok.
      statsHits++
      if (statsHits === 1) return { ok: false, status: 401, json: async () => ({}) } as unknown as Response
      return { ok: true, status: 200, json: async () => ({ pageviews: 7, visitors: 2, visits: 2, bounces: 1, totaltime: 100 }) } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    const umami = await import('./umami')
    const s = await umami.getSummary(30)
    expect(s?.pageviews).toBe(7)
    const loginCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/auth/login'))
    expect(loginCalls.length).toBe(2) // initial + re-login
  })

  it('opens the circuit breaker on a transport failure and short-circuits the next call', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes('/api/auth/login')) {
        return { ok: true, status: 200, json: async () => ({ token: 'tok' }) } as unknown as Response
      }
      throw new Error('ECONNREFUSED')
    })
    vi.stubGlobal('fetch', fetchMock)
    const umami = await import('./umami')

    expect(await umami.getSummary(30)).toBeNull()
    const callsAfterFirst = fetchMock.mock.calls.length
    expect(await umami.getSummary(30)).toBeNull()
    // Breaker open → no new network calls on the second attempt.
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst)
  })
})

describe('getActiveVisitors', () => {
  it('reads { visitors } and returns 0 on failure', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/api/auth/login': () => ({ token: 'tok' }),
      '/active': () => ({ visitors: 4 }),
    }))
    const umami = await import('./umami')
    expect(await umami.getActiveVisitors()).toBe(4)
  })
})

describe('healthCheck', () => {
  it('reports missing vars without a network call', async () => {
    delete process.env.UMAMI_WEBSITE_ID
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const umami = await import('./umami')
    const h = await umami.healthCheck()
    expect(h.configured).toBe(false)
    expect(h.status).toBe('warning')
    expect(h.message).toContain('UMAMI_WEBSITE_ID')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports login denied on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) } as unknown as Response)))
    const umami = await import('./umami')
    const h = await umami.healthCheck()
    expect(h.status).toBe('error')
    expect(h.message).toContain('Inloggen geweigerd')
  })

  it('reports unreachable on a transport failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ENOTFOUND') }))
    const umami = await import('./umami')
    const h = await umami.healthCheck()
    expect(h.status).toBe('error')
    expect(h.message).toContain('Niet bereikbaar')
  })

  it('reports connected on a successful login + active probe', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/api/auth/login': () => ({ token: 'tok' }),
      '/active': () => ({ visitors: 2 }),
    }))
    const umami = await import('./umami')
    const h = await umami.healthCheck()
    expect(h.status).toBe('ok')
    expect(h.message).toContain('Verbonden')
  })
})

describe('dayRange', () => {
  it('returns epoch-ms [start, end] for the trailing window', async () => {
    const { dayRange } = await import('./umami')
    expect(dayRange(1, 1000)).toEqual([(1000 - 86400) * 1000, 1000 * 1000])
  })
})

describe('getPageviewSeries (network)', () => {
  it('logs in, fetches /pageviews and gap-fills the series', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/api/auth/login': () => ({ token: 'tok' }),
      '/pageviews': () => ({ pageviews: [], sessions: [] }),
    }))
    const umami = await import('./umami')
    const series = await umami.getPageviewSeries(7)
    expect(series).toHaveLength(7)
    expect(series.every(p => p.views === 0 && p.sessions === 0)).toBe(true)
    expect(series[0].date < series[6].date).toBe(true) // ascending, oldest-first
  })
})

describe('healthCheck — website not found', () => {
  it('reports the website-id error when /active returns 404 after login', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.includes('/api/auth/login')) {
        return { ok: true, status: 200, json: async () => ({ token: 'tok' }) } as unknown as Response
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response
    }))
    const umami = await import('./umami')
    const h = await umami.healthCheck()
    expect(h.status).toBe('error')
    expect(h.message).toContain('website-id niet gevonden')
  })
})
