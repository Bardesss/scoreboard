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
 * UMAMI_API_URL. The browser tracking tag (src/components/UmamiAnalytics.tsx)
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

const REQUIRED_VARS = ['UMAMI_API_URL', 'UMAMI_WEBSITE_ID', 'UMAMI_USERNAME', 'UMAMI_PASSWORD'] as const

export function umamiConfigured(): boolean {
  return REQUIRED_VARS.every(v => (process.env[v] ?? '') !== '')
}

/** Base URL for server-to-server calls: internal when set, else public. */
export function apiBase(): string {
  const internal = process.env.UMAMI_INTERNAL_URL ?? ''
  if (internal !== '') return internal.replace(/\/$/, '')
  return (process.env.UMAMI_API_URL ?? '').replace(/\/$/, '')
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
      return { configured: true, status: 'error', message: 'Niet bereikbaar — controleer UMAMI_API_URL / UMAMI_INTERNAL_URL / netwerk' }
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
