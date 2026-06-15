# Umami Stats on the Admin Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show live + 30-day website analytics from the self-hosted Umami instance on the `/admin` dashboard, with connection diagnostics on the integrations settings page.

**Architecture:** A server-side Umami REST client (`src/lib/umami.ts`) owns auth (username/password → cached bearer token), resilient fetch (short timeouts + in-memory circuit breaker), tolerant response parsing, and a diagnostic health check. The dashboard fetches summary + trend server-side and renders native cards + a Recharts chart; a small client component polls a thin admin API route for the live "online now" count. Detailed diagnostics live on `/admin/settings/integrations`, mirroring the existing Mailgun card.

**Tech Stack:** Next.js 15 (App Router, server components), TypeScript, Recharts ^3.8.1 (already a dep), Vitest, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-06-15-umami-admin-dashboard-design.md`

---

## File Structure

**Create:**
- `src/lib/umami.ts` — server-side Umami client + pure parsers + `healthCheck`
- `src/lib/umami.test.ts` — unit tests (mocked `fetch`)
- `src/app/api/admin/analytics/route.ts` — admin-only live-count endpoint
- `src/app/api/admin/analytics/route.test.ts` — route auth/behaviour test
- `src/components/admin/AnalyticsSection.tsx` — server component (KPIs + chart + notice)
- `src/components/admin/AnalyticsTrendChart.tsx` — `'use client'` Recharts area chart
- `src/components/admin/AnalyticsLiveCount.tsx` — `'use client'` polling badge

**Modify:**
- `src/app/admin/page.tsx` — fetch summary/series, render `<AnalyticsSection>`
- `src/app/admin/settings/integrations/page.tsx` — pass `umamiConfigured()` to client
- `src/app/admin/settings/integrations/IntegrationsClient.tsx` — add Umami status card
- `src/app/admin/settings/integrations/actions.ts` — add `testUmamiConnection` action
- `README.md` — document the new `UMAMI_*` env vars

---

## Task 1: Server-side Umami client (`src/lib/umami.ts`)

**Files:**
- Create: `src/lib/umami.ts`
- Test: `src/lib/umami.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/umami.test.ts`:

```ts
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
  return vi.fn(async (input: string) => {
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/umami.test.ts`
Expected: FAIL — `Cannot find module './umami'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/umami.ts`:

```ts
/**
 * Read-only server-side client for the self-hosted Umami analytics API.
 *
 * Owns: username/password -> cached bearer token, short-timeout fetch with an
 * in-memory circuit breaker (so a slow/down Umami never stalls the dashboard),
 * tolerant parsing of the two /stats shapes Umami ships across versions, and a
 * diagnostic healthCheck().
 *
 * IMPORTANT — internal vs external URL: server-to-server calls go to
 * UMAMI_INTERNAL_URL when set (the internal Docker address, e.g.
 * http://umami-xxxx:3000), avoiding hairpin-NAT failures where a container
 * cannot reach its own host's public URL. Falls back to the public
 * UMAMI_URL. The browser tracking tag (src/components/UmamiAnalytics.tsx)
 * always uses the public URL and is untouched by this module.
 *
 * Every network method returns null/0/[] on any failure and never throws.
 */

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000 // 6h
const BREAKER_TTL_MS = 5 * 60 * 1000 // 5 min
const REQUEST_TIMEOUT_MS = 4000
const LOGIN_TIMEOUT_MS = 12000
const TIMEZONE = 'Europe/Amsterdam'

// Module-level cache (per worker process). Reset on module reload (tests use
// vi.resetModules()).
let cachedToken: string | null = null
let tokenExpiresAt = 0
let serviceDownUntil = 0

export type UmamiSummary = {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
  totaltime: number
  bounceRate: number // percent, 1 decimal
  avgVisitTime: number // seconds
  prev: {
    pageviews: number | null
    visitors: number | null
    visits: number | null
    bounces: number | null
    totaltime: number | null
  }
}

export type UmamiSeriesPoint = { date: string; views: number; sessions: number }

export type UmamiHealth = {
  configured: boolean
  status: 'ok' | 'warning' | 'error'
  message: string
}

const REQUIRED_VARS = ['UMAMI_URL', 'UMAMI_WEBSITE_ID', 'UMAMI_USERNAME', 'UMAMI_PASSWORD'] as const

export function umamiConfigured(): boolean {
  return REQUIRED_VARS.every(v => (process.env[v] ?? '') !== '')
}

/** Base URL for server-to-server calls: internal when set, else public. */
export function apiBase(): string {
  const internal = process.env.UMAMI_INTERNAL_URL ?? ''
  if (internal !== '') return internal.replace(/\/$/, '')
  return (process.env.UMAMI_URL ?? '').replace(/\/$/, '')
}

// ── Pure helpers (network-free, unit-tested) ──────────────────────────────

/** Epoch-ms [start, end] for the trailing `days` ending at `nowSec`. */
export function dayRange(days: number, nowSec: number): [number, number] {
  return [(nowSec - days * 86400) * 1000, nowSec * 1000]
}

function num(v: unknown): number {
  if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    return Number((v as { value: unknown }).value) || 0
  }
  return Number(v) || 0
}

function prevOf(raw: Record<string, unknown>, key: string): number | null {
  const node = raw[key]
  if (node && typeof node === 'object' && (node as Record<string, unknown>).prev != null) {
    return Number((node as { prev: unknown }).prev) || 0
  }
  const cmp = raw.comparison
  if (cmp && typeof cmp === 'object' && (cmp as Record<string, unknown>)[key] != null) {
    return num((cmp as Record<string, unknown>)[key])
  }
  return null
}

/** Normalize a /stats payload, tolerating both flat and nested shapes. */
export function parseStats(raw: Record<string, unknown>): UmamiSummary {
  const pageviews = num(raw.pageviews)
  const visitors = num(raw.visitors)
  const visits = num(raw.visits)
  const bounces = num(raw.bounces)
  const totaltime = num(raw.totaltime)
  return {
    pageviews,
    visitors,
    visits,
    bounces,
    totaltime,
    bounceRate: visits > 0 ? Math.round((bounces / visits) * 1000) / 10 : 0,
    avgVisitTime: visits > 0 ? Math.round(totaltime / visits) : 0,
    prev: {
      pageviews: prevOf(raw, 'pageviews'),
      visitors: prevOf(raw, 'visitors'),
      visits: prevOf(raw, 'visits'),
      bounces: prevOf(raw, 'bounces'),
      totaltime: prevOf(raw, 'totaltime'),
    },
  }
}

function ymdUtc(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type XY = { x?: unknown; y?: unknown }

/** Build a gap-filled daily series. visitors<-sessions (Umami has no per-day uniques). */
export function normalizeSeries(pageviews: XY[], sessions: XY[], days: number, endSec: number): UmamiSeriesPoint[] {
  const viewsByDate = new Map<string, number>()
  const sessByDate = new Map<string, number>()
  for (const p of pageviews ?? []) {
    const d = String(p?.x ?? '').slice(0, 10)
    if (d) viewsByDate.set(d, Number(p.y) || 0)
  }
  for (const s of sessions ?? []) {
    const d = String(s?.x ?? '').slice(0, 10)
    if (d) sessByDate.set(d, Number(s.y) || 0)
  }
  const out: UmamiSeriesPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = ymdUtc(endSec - i * 86400)
    out.push({ date: d, views: viewsByDate.get(d) ?? 0, sessions: sessByDate.get(d) ?? 0 })
  }
  return out
}

// ── Transport & auth (network) ────────────────────────────────────────────

type HttpResult = { status: number; data: unknown }

/** Single JSON request. Returns {status:0,data:null} on a transport failure. */
async function httpJson(
  method: 'GET' | 'POST',
  path: string,
  opts: { body?: unknown; token?: string; timeoutMs?: number } = {},
): Promise<HttpResult> {
  const url = apiBase() + path
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(opts.timeoutMs ?? REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    }
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(opts.body ?? {})
    }
    const res = await fetch(url, init)
    if (res.ok) return { status: res.status, data: await res.json().catch(() => null) }
    return { status: res.status, data: null }
  } catch {
    return { status: 0, data: null }
  }
}

async function login(): Promise<string | null> {
  const res = await httpJson('POST', '/api/auth/login', {
    body: { username: process.env.UMAMI_USERNAME, password: process.env.UMAMI_PASSWORD },
    timeoutMs: LOGIN_TIMEOUT_MS,
  })
  const token = (res.data as { token?: string } | null)?.token
  if (token) {
    cachedToken = token
    tokenExpiresAt = Date.now() + TOKEN_TTL_MS
    return token
  }
  return null
}

async function getToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) return cachedToken
  return login()
}

/** Authenticated GET against /api{path}. Re-logs in once on 401. */
async function apiGet(path: string, query: Record<string, string | number> = {}): Promise<unknown> {
  if (!umamiConfigured()) return null
  if (Date.now() < serviceDownUntil) return null // breaker open

  let token = await getToken()
  if (!token) return null

  const qs = Object.keys(query).length
    ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)]))).toString()
    : ''
  const fullPath = '/api' + path + qs

  let res = await httpJson('GET', fullPath, { token })
  if (res.status === 401) {
    token = await getToken(true)
    if (!token) return null
    res = await httpJson('GET', fullPath, { token })
  }
  if (res.status === 0) {
    serviceDownUntil = Date.now() + BREAKER_TTL_MS // transport failure → trip breaker
    return null
  }
  return res.data
}

function statQuery(startMs: number, endMs: number): Record<string, string | number> {
  return { startAt: startMs, endAt: endMs, unit: 'day', timezone: TIMEZONE }
}

function websitePath(suffix: string): string {
  return `/websites/${process.env.UMAMI_WEBSITE_ID}${suffix}`
}

// ── Public data methods ───────────────────────────────────────────────────

/** Normalized stats for the trailing `days`, or null on failure. */
export async function getSummary(days = 30): Promise<UmamiSummary | null> {
  const [start, end] = dayRange(days, Math.floor(Date.now() / 1000))
  const raw = await apiGet(websitePath('/stats'), statQuery(start, end))
  return raw && typeof raw === 'object' ? parseStats(raw as Record<string, unknown>) : null
}

/** Gap-filled daily [{date,views,sessions}] for the trailing `days`. */
export async function getPageviewSeries(days = 30): Promise<UmamiSeriesPoint[]> {
  const nowSec = Math.floor(Date.now() / 1000)
  const [start, end] = dayRange(days, nowSec)
  const raw = await apiGet(websitePath('/pageviews'), statQuery(start, end))
  if (!raw || typeof raw !== 'object') return []
  const r = raw as { pageviews?: XY[]; sessions?: XY[] }
  return normalizeSeries(r.pageviews ?? [], r.sessions ?? [], days, nowSec)
}

/** Live active-visitor count (0 on failure). */
export async function getActiveVisitors(): Promise<number> {
  const raw = await apiGet(websitePath('/active'))
  return raw && typeof raw === 'object' ? Number((raw as { visitors?: unknown }).visitors) || 0 : 0
}

/**
 * Diagnostic for the integrations page. Bypasses the token cache + breaker so
 * it always reflects live state. Names the precise misconfiguration.
 */
export async function healthCheck(): Promise<UmamiHealth> {
  const missing = REQUIRED_VARS.filter(v => (process.env[v] ?? '') === '')
  if (missing.length) {
    return { configured: false, status: 'warning', message: `Niet geconfigureerd — ontbreekt: ${missing.join(', ')}` }
  }

  const loginRes = await httpJson('POST', '/api/auth/login', {
    body: { username: process.env.UMAMI_USERNAME, password: process.env.UMAMI_PASSWORD },
    timeoutMs: LOGIN_TIMEOUT_MS,
  })
  const token = (loginRes.data as { token?: string } | null)?.token
  if (!token) {
    if (loginRes.status === 401 || loginRes.status === 403) {
      return { configured: true, status: 'error', message: 'Inloggen geweigerd — controleer gebruiker/wachtwoord' }
    }
    if (loginRes.status === 0) {
      return { configured: true, status: 'error', message: 'Niet bereikbaar — controleer UMAMI_URL / UMAMI_INTERNAL_URL / netwerk' }
    }
    return { configured: true, status: 'error', message: `Inloggen mislukt (HTTP ${loginRes.status})` }
  }

  // Login OK — cache token + clear breaker, then validate the website id.
  cachedToken = token
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS
  serviceDownUntil = 0

  const active = await httpJson('GET', `/api/websites/${process.env.UMAMI_WEBSITE_ID}/active`, { token })
  if (active.status >= 200 && active.status < 300) {
    const n = Number((active.data as { visitors?: unknown } | null)?.visitors) || 0
    return { configured: true, status: 'ok', message: `Verbonden · ${n} nu online` }
  }
  if (active.status === 401 || active.status === 403) {
    return { configured: true, status: 'error', message: 'Ingelogd, maar geen toegang tot deze website — koppel de Umami-gebruiker aan de site of gebruik het account dat de site bezit' }
  }
  if (active.status === 400 || active.status === 404) {
    return { configured: true, status: 'error', message: `Ingelogd, maar website-id niet gevonden (HTTP ${active.status}) — controleer UMAMI_WEBSITE_ID` }
  }
  return { configured: true, status: 'warning', message: `Ingelogd; kon site-data niet ophalen (HTTP ${active.status})` }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/umami.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/umami.ts src/lib/umami.test.ts
git commit -m "feat(analytics): server-side Umami client with internal-URL + breaker"
```

---

## Task 2: Admin live-count API route

**Files:**
- Create: `src/app/api/admin/analytics/route.ts`
- Test: `src/app/api/admin/analytics/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/analytics/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/umami', () => ({ getActiveVisitors: vi.fn() }))

import { auth } from '@/lib/auth'
import { getActiveVisitors } from '@/lib/umami'
import { GET } from './route'

describe('GET /api/admin/analytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: 'user' } } as never)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns the active count for an admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as never)
    vi.mocked(getActiveVisitors).mockResolvedValue(5)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ active: 5 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/admin/analytics/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/admin/analytics/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getActiveVisitors } from '@/lib/umami'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const active = await getActiveVisitors()
  return NextResponse.json({ active }, { headers: { 'Cache-Control': 'no-store' } })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/api/admin/analytics/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/analytics/route.ts src/app/api/admin/analytics/route.test.ts
git commit -m "feat(analytics): admin-only live-count API route"
```

---

## Task 3: Client components (live count + trend chart)

These are presentational client components with no unit tests (verified via the build + manual check in Task 6's verification).

**Files:**
- Create: `src/components/admin/AnalyticsLiveCount.tsx`
- Create: `src/components/admin/AnalyticsTrendChart.tsx`

- [ ] **Step 1: Create the live-count badge**

Create `src/components/admin/AnalyticsLiveCount.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

/** Polls the admin live-count endpoint every 60s. Renders nothing until the
 * first successful fetch, and silently stays hidden on error. */
export default function AnalyticsLiveCount() {
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/analytics', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { active?: number }
        if (!cancelled) setActive(data.active ?? 0)
      } catch {
        /* ignore — badge just stays hidden */
      }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (active === null) return null

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#4ade80',
          boxShadow: '0 0 0 3px rgba(74,222,128,0.2)',
        }}
      />
      {active} online nu
    </span>
  )
}
```

- [ ] **Step 2: Create the trend chart**

Create `src/components/admin/AnalyticsTrendChart.tsx`:

```tsx
'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { UmamiSeriesPoint } from '@/lib/umami'

export default function AnalyticsTrendChart({ series }: { series: UmamiSeriesPoint[] }) {
  const data = series.map(p => ({ ...p, label: p.date.slice(5) })) // MM-DD

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="umamiViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a8eff" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#4a8eff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="umamiSessions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#0c0f10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="views" name="Weergaven" stroke="#4a8eff" fill="url(#umamiViews)" strokeWidth={2} />
          <Area type="monotone" dataKey="sessions" name="Sessies" stroke="#4ade80" fill="url(#umamiSessions)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AnalyticsLiveCount.tsx src/components/admin/AnalyticsTrendChart.tsx
git commit -m "feat(analytics): live-count badge + trend chart components"
```

---

## Task 4: Analytics section + dashboard wiring

**Files:**
- Create: `src/components/admin/AnalyticsSection.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create the section component**

Create `src/components/admin/AnalyticsSection.tsx`:

```tsx
import type { UmamiSummary, UmamiSeriesPoint } from '@/lib/umami'
import AnalyticsTrendChart from './AnalyticsTrendChart'
import AnalyticsLiveCount from './AnalyticsLiveCount'
import { Users, Eye, MousePointerClick, LogOut, Clock } from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: '#161f28',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 20,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Delta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev === null || prev === 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  const color = pct > 0 ? '#4ade80' : pct < 0 ? '#f87171' : 'rgba(255,255,255,0.4)'
  return (
    <span style={{ fontSize: 12, color, fontWeight: 600 }}>
      {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  )
}

export default function AnalyticsSection({
  summary,
  series,
}: {
  summary: UmamiSummary | null
  series: UmamiSeriesPoint[]
}) {
  const kpis = summary
    ? [
        { label: 'Bezoekers', value: summary.visitors, prev: summary.prev.visitors, icon: Users },
        { label: 'Paginaweergaven', value: summary.pageviews, prev: summary.prev.pageviews, icon: Eye },
        { label: 'Bezoeken', value: summary.visits, prev: summary.prev.visits, icon: MousePointerClick },
        { label: 'Bouncepercentage', value: `${summary.bounceRate}%`, prev: null, icon: LogOut },
        { label: 'Gem. bezoekduur', value: formatDuration(summary.avgVisitTime), prev: null, icon: Clock },
      ]
    : []

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 className="font-headline" style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>
          Website-analyse
        </h2>
        <AnalyticsLiveCount />
      </div>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>laatste 30 dagen</p>

      {summary === null ? (
        <div
          style={{
            background: '#161f28',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 20,
            fontSize: 14,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Analytics tijdelijk niet beschikbaar.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {kpis.map(({ label, value, prev, icon: Icon }) => (
              <div key={label} style={cardStyle}>
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: 'rgba(74,142,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} style={{ color: '#4a8eff' }} />
                </div>
                <span
                  className="font-headline"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  {label}
                </span>
                <span className="font-headline" style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.87)', lineHeight: 1 }}>
                  {value}
                </span>
                {typeof value === 'number' && <Delta cur={value} prev={prev} />}
              </div>
            ))}
          </div>

          <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
            <AnalyticsTrendChart series={series} />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the dashboard**

In `src/app/admin/page.tsx`, add imports at the top (after the existing imports):

```tsx
import { umamiConfigured, getSummary, getPageviewSeries } from '@/lib/umami'
import AnalyticsSection from '@/components/admin/AnalyticsSection'
```

Replace the existing data-fetch block (the `const [userCount, ...] = await Promise.all([...])`) so the Umami calls join it, gated by config:

```tsx
  const umamiOn = umamiConfigured()

  const [
    userCount,
    unverifiedCount,
    playedGameCount,
    templateCount,
    leagueCount,
    pendingCount,
    recentGames,
    umamiSummary,
    umamiSeries,
  ] = await Promise.all([
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.count({ where: { emailVerified: null } }),
    prisma.playedGame.count(),
    prisma.gameTemplate.count(),
    prisma.league.count(),
    prisma.playedGame.count({ where: { status: 'pending_approval' } }),
    prisma.playedGame.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        league: { select: { name: true } },
        submittedBy: { select: { email: true } },
      },
    }),
    umamiOn ? getSummary() : Promise.resolve(null),
    umamiOn ? getPageviewSeries() : Promise.resolve([]),
  ])
```

Then, immediately before the final closing `</div>` of the returned JSX (after the "Recente activiteit" card block), add:

```tsx
      {umamiOn && <AnalyticsSection summary={umamiSummary} series={umamiSeries} />}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. (The repo's build skips type-checking — run `tsc` manually per project convention.)

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AnalyticsSection.tsx src/app/admin/page.tsx
git commit -m "feat(analytics): render Website-analyse section on the dashboard"
```

---

## Task 5: Umami diagnostics on the integrations page

**Files:**
- Modify: `src/app/admin/settings/integrations/actions.ts`
- Modify: `src/app/admin/settings/integrations/page.tsx`
- Modify: `src/app/admin/settings/integrations/IntegrationsClient.tsx`

- [ ] **Step 1: Add the `testUmamiConnection` server action**

In `src/app/admin/settings/integrations/actions.ts`, add the import at the top:

```ts
import { healthCheck } from '@/lib/umami'
```

And append this action at the end of the file:

```ts
export async function testUmamiConnection(): Promise<{ success: boolean; status: 'ok' | 'warning' | 'error'; message: string }> {
  try {
    await assertAdmin()
    const health = await healthCheck()
    return { success: health.status === 'ok', status: health.status, message: health.message }
  } catch {
    return { success: false, status: 'error', message: 'Niet gemachtigd' }
  }
}
```

- [ ] **Step 2: Pass Umami config state from the page**

In `src/app/admin/settings/integrations/page.tsx`, add the import:

```tsx
import { umamiConfigured } from '@/lib/umami'
```

Then pass a `umami` prop to `<IntegrationsClient>` (alongside the existing props):

```tsx
    <IntegrationsClient
      mailgun={/* unchanged */ mailgun ? {
        status: mailgun.status,
        lastTestedAt: mailgun.lastTestedAt?.toISOString() ?? null,
        lastError: mailgun.lastError,
        apiKey: mailgunConfig?.apiKey ?? '',
        domain: mailgunConfig?.domain ?? '',
        from: mailgunConfig?.from ?? '',
        region: mailgunConfig?.region === 'us' ? 'us' : 'eu',
      } : null}
      mailgunStats={mailgunStats}
      umami={{ configured: umamiConfigured() }}
    />
```

- [ ] **Step 3: Add the Umami status card to the client**

In `src/app/admin/settings/integrations/IntegrationsClient.tsx`:

(a) Extend the imports:

```tsx
import { saveMailgunConfig, testMailgunConnection, testUmamiConnection } from './actions'
```

(b) Extend the component props signature:

```tsx
export default function IntegrationsClient({
  mailgun,
  mailgunStats,
  umami,
}: {
  mailgun: IntegrationRow | null
  mailgunStats: MailgunStats | null
  umami: { configured: boolean }
}) {
```

(c) Add Umami state + handler near the other hooks (after the `isTesting` transition):

```tsx
  const [umamiStatus, setUmamiStatus] = useState<'ok' | 'warning' | 'error' | 'unconfigured'>('unconfigured')
  const [umamiMessage, setUmamiMessage] = useState<string | null>(null)
  const [isTestingUmami, startTestUmami] = useTransition()

  function handleTestUmami() {
    startTestUmami(async () => {
      const result = await testUmamiConnection()
      setUmamiStatus(result.status)
      setUmamiMessage(result.message)
      if (result.success) toast.success('Umami verbonden')
      else toast.error(result.message)
    })
  }
```

(d) Add the Umami card to the JSX, immediately before `<StubCard name="Mollie" icon="💳" />`:

```tsx
      {/* Umami card — env-configured, read-only status + test */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>Umami Analytics</span>
          </div>
          <StatusBadge status={umamiStatus} />
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>
          Geconfigureerd via omgevingsvariabelen (<code>UMAMI_URL</code>, <code>UMAMI_INTERNAL_URL</code>,{' '}
          <code>UMAMI_WEBSITE_ID</code>, <code>UMAMI_USERNAME</code>, <code>UMAMI_PASSWORD</code>). Voedt het
          dashboard-paneel “Website-analyse”.
        </p>

        {!umami.configured && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Nog niet geconfigureerd — stel de <code>UMAMI_*</code> variabelen in.
          </div>
        )}

        {umamiMessage && (
          <div
            style={{
              background: umamiStatus === 'error' ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)',
              border: `1px solid ${umamiStatus === 'error' ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`,
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 14,
              fontSize: 13,
              color: umamiStatus === 'error' ? '#f87171' : '#4ade80',
            }}
          >
            {umamiMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleTestUmami}
          disabled={isTestingUmami || !umami.configured}
          style={btnStyle('rgba(255,255,255,0.1)', isTestingUmami || !umami.configured)}
        >
          {isTestingUmami ? 'Testen…' : 'Test verbinding'}
        </button>
      </div>
```

Note: `StatusBadge`'s map has no `warning` key; it falls back to the neutral "Niet geconfigureerd" style, which is acceptable. To label warnings distinctly, add a `warning` entry to the `map` in `StatusBadge`:

```tsx
    warning:      { label: 'Aandacht nodig',       color: '#fbbf24',               bg: 'rgba(251,191,36,0.12)' },
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/settings/integrations/actions.ts src/app/admin/settings/integrations/page.tsx src/app/admin/settings/integrations/IntegrationsClient.tsx
git commit -m "feat(analytics): Umami connection diagnostics on integrations page"
```

---

## Task 6: README docs + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the env vars**

In `README.md`, directly after the Mailgun note block (the line ending `re-enter them in the admin UI after rotating.`), insert a new subsection:

```markdown
### Optional — Umami analytics dashboard

Set these to surface website analytics on the admin dashboard (`/admin`) and a
connection test on `/admin/settings/integrations`. All optional: if any are
missing, the analytics panel is simply hidden — nothing fails.

| Variable | Description |
|---|---|
| `UMAMI_URL` | Public base URL of the Umami instance, e.g. `https://analytics.bartusoost.nl`. |
| `UMAMI_INTERNAL_URL` | **Recommended on Coolify.** Internal base URL for server-to-server API calls, e.g. `http://umami-xxxx:3000`. Used in preference to `UMAMI_URL` so the app container reaches Umami over the internal Docker network instead of the public URL (which a container often cannot reach via hairpin NAT). The browser tracking tag always uses the public URL. |
| `UMAMI_WEBSITE_ID` | Website UUID (same id as the tracking tag). |
| `UMAMI_USERNAME` | Umami login user (read access to the website). |
| `UMAMI_PASSWORD` | Umami login password. |

> If the dashboard shows "tijdelijk niet beschikbaar", open
> `/admin/settings/integrations` → Umami → **Test verbinding** for the precise
> reason (unreachable URL, bad credentials, wrong website-id, or the Umami user
> not being linked to the site).
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all existing tests plus the new `umami` and `route` suites.

- [ ] **Step 3: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Production build (catches client/server boundary issues)**

Run: `npx next build`
Expected: build completes; `/admin` and `/admin/settings/integrations` compile without "use client"/server-only errors.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document UMAMI_* env vars for the analytics dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** config/optionality (Task 1 `umamiConfigured`), internal-vs-external URL (Task 1 `apiBase`), token cache + 401 retry + breaker + timeouts (Task 1), tolerant `parseStats` both shapes (Task 1), `/active` `{visitors}` (Task 1), gap-filled series (Task 1), `healthCheck` messages (Task 1), live-count route admin gate (Task 2), live badge + trend chart (Task 3), summary KPIs + chart + minimal notice on dashboard (Task 4), diagnostics on integrations page (Task 5), README (Task 6). All spec sections map to a task.
- **Type consistency:** `UmamiSummary` / `UmamiSeriesPoint` / `UmamiHealth` defined in Task 1 are the exact types consumed in Tasks 2–5. `getActiveVisitors`, `getSummary`, `getPageviewSeries`, `umamiConfigured`, `apiBase`, `healthCheck` names match across tasks.
- **Out of scope (per spec):** top pages/referrers, date picker, replacing the tracking tag's hardcoded values, cross-worker (Redis) token cache.
```
