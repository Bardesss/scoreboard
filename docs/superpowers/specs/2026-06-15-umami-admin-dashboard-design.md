# Umami stats on the admin dashboard — design

**Date:** 2026-06-15
**Status:** Approved (pending spec review)

## Goal

Surface live and recent website analytics from the self-hosted Umami instance on
the admin dashboard (`/admin`). The dashboard already shows app KPIs (users,
games, etc.) and recent activity; this adds a "Website-analyse" section with
traffic stats pulled server-side from the Umami REST API.

Scope is deliberately small: summary KPIs + a 30-day trend chart + a live
"currently online" count. No top-pages / referrers / date-picker in v1.

## Background & prior art

Umami was just added to public pages via `src/components/UmamiAnalytics.tsx`
(instance `https://analytics.bartusoost.nl`, website id
`f71f7b9b-7beb-4d05-ad64-52f1c928de12`). That component is the **browser
tracking tag** and stays as-is.

A sibling project (`C:\Users\Bartus\Dev\clickbait`,
`includes/services/umami_client.php`) already ships a mature, battle-tested
Umami client. We port its hard-won lessons:

1. **Internal vs external URL (the key fix).** Server-to-server calls to the
   *public* HTTPS URL fail from inside the app container (hairpin NAT — a
   container reaching its own host's public address). The fix is a separate
   internal base URL for API calls while the browser tag keeps the public URL.
2. `/stats` comes in two shapes across Umami versions — flat
   (`{pageviews: 20, comparison:{pageviews:18}}`) and nested
   (`{pageviews:{value:20,prev:18}}`). Parsing must tolerate both.
3. `/active` returns `{ visitors: N }` (not `[{x:N}]`).
4. `/pageviews` exposes daily **sessions**, not per-day unique visitors — the
   trend "visitors" series maps to sessions and is gap-filled per day.
5. A slow/unreachable Umami must never stall the dashboard → short timeouts +
   circuit breaker.
6. A diagnostic health check that names the precise misconfiguration is worth a
   lot (the "user not linked to the website" case in particular).

## Configuration (all optional)

Server-side env vars (read in `src/lib/umami.ts`):

| Var | Required for feature | Purpose |
|-----|----------------------|---------|
| `UMAMI_API_URL` | yes | Public base URL of the Umami instance, e.g. `https://analytics.bartusoost.nl`. |
| `UMAMI_INTERNAL_URL` | no | Internal base URL for server-to-server API calls, e.g. `http://umami-xxxx:3000`. **Preferred** when set; falls back to `UMAMI_API_URL`. |
| `UMAMI_WEBSITE_ID` | yes | Website UUID. |
| `UMAMI_USERNAME` | yes | Umami login user. |
| `UMAMI_PASSWORD` | yes | Umami login password. |

**Optionality is a hard requirement.** If any of the required vars are missing,
`umamiConfigured()` returns `false`, the dashboard section is omitted entirely,
and nothing throws. This feature must NOT join the production hard-fail set
(unlike `REDIS_URL` / `NEXTAUTH_SECRET` / `CRON_SECRET`). Deploys without Umami
config keep working unchanged.

The public tracking tag (`UmamiAnalytics.tsx`) is left untouched. The website id
is therefore duplicated (hardcoded in the tag, env var for the API). Acceptable
for v1; noted here so it is a deliberate choice, not an oversight. No
`NEXT_PUBLIC_*` var is introduced, to avoid touching the working tracking tag.

## Components

### 1. `src/lib/umami.ts` — server-side Umami client

Pure-ish module with an in-memory cache (module-level, per worker process). All
network methods return `null`/`0`/`[]` on any failure and never throw.

**Config / URL resolution**
- `umamiConfigured(): boolean` — all required vars present and non-empty.
- `apiBase(): string` — `UMAMI_INTERNAL_URL` if set, else `UMAMI_API_URL`.

**Transport & auth** (private)
- Module-level cache: `{ token: string | null, tokenExpiresAt: number }` and
  `{ serviceDownUntil: number }`.
- `getToken(forceRefresh?)`: returns cached token if fresh (TTL 6h); otherwise
  `POST {apiBase}/api/auth/login` with `{username, password}`, caches
  `resp.token`.
- `umamiFetch(path, { method, body, token })`: `fetch` with
  `AbortSignal.timeout(4000)` (login uses 12000). On a transport error / abort,
  opens the circuit breaker (`serviceDownUntil = now + 5 min`) and returns
  `{ status: 0, data: null }`. On 2xx, clears the breaker and returns parsed
  JSON. On 401, returns status so the caller can re-login once.
- `apiGet(path, query)`: short-circuits if not configured or breaker open;
  gets token; GETs `/api{path}?{query}`; on 401 re-logins once and retries.

**Pure parsing helpers** (network-free, unit-tested)
- `parseStats(raw)`: tolerates flat + nested shapes; returns
  `{ pageviews, visitors, visits, bounces, totaltime, bounceRate, avgVisitTime, prev: { pageviews, visitors, visits, bounces, totaltime } }`.
  `bounceRate = visits>0 ? round(bounces/visits*100,1) : 0`.
  `avgVisitTime = visits>0 ? round(totaltime/visits) : 0` (seconds).
- `normalizeSeries(pageviews, sessions, days, endSec)`: gap-filled, oldest-first
  `[{ date: 'YYYY-MM-DD', views, sessions }]`.

**Public data methods**
- `getSummary(days = 30)`: `GET /websites/{id}/stats?startAt&endAt&unit=day&timezone=Europe/Amsterdam` → `parseStats` or `null`.
- `getPageviewSeries(days = 30)`: `GET /websites/{id}/pageviews?…` → `normalizeSeries` or `[]`.
- `getActiveVisitors()`: `GET /websites/{id}/active` → `raw.visitors ?? 0`, `0` on failure.
- `healthCheck()`: bypasses token cache + breaker; does a fresh login then hits
  `/active`, returning `{ configured, status: 'ok'|'warning'|'error', message }`
  with specific Dutch messages for: missing vars, unreachable
  (`UMAMI_INTERNAL_URL` / `UMAMI_API_URL` / network), login denied (401/403),
  website-id not found (400/404), user-not-linked-to-site (401/403 on `/active`
  after a successful login).

Time window: trailing `days` ending now; epoch-ms. Timezone `Europe/Amsterdam`.

Optional 60s in-memory result cache for `getSummary` / `getPageviewSeries` so
repeated dashboard loads don't re-hit Umami. (Token cache already prevents
re-login.) Live count is never result-cached.

### 2. `src/app/api/admin/analytics/route.ts` — live-count endpoint

- `GET`, admin-only: `const session = await auth()`; if `!session` → 401; if
  `session.user.role !== 'admin'` → 403. (Mirrors `src/app/admin/layout.tsx`.)
- Returns `{ active: number }` from `getActiveVisitors()`. Lightweight; used by
  the polling client component. `Cache-Control: no-store`.

### 3. `src/app/admin/page.tsx` — dashboard wiring

- Guard: only render the section when `umamiConfigured()`.
- Add `getSummary()` + `getPageviewSeries()` to the existing `Promise.all`
  (server-side, at render).
- Render `<AnalyticsSection summary={…} series={…} health={…} />` below the
  existing "Recente activiteit" card. When `summary` is `null`, compute
  `healthCheck()` and pass it so the section can show the precise reason.

### 4. `src/components/admin/AnalyticsSection.tsx` — server component

- Section header: "Website-analyse" + subtitle "laatste 30 dagen", and the live
  `<AnalyticsLiveCount />` badge on the right.
- If `summary` is null: a subtle card showing `health.message`
  (e.g. "Niet bereikbaar — controleer UMAMI_API_URL / UMAMI_INTERNAL_URL").
- Summary KPI cards (reusing the existing dashboard card styling): **Bezoekers**,
  **Paginaweergaven**, **Bezoeken**, **Bouncepercentage**, **Gem. bezoekduur**.
  Each shows the value and a green/red % change vs the previous period (computed
  from `prev`); no arrow when `prev` is null/zero.
- Trend chart: a dark-themed Recharts area chart (Recharts ^3.8.1 already a
  dependency) of daily **views** and **sessions** over 30 days. Must be in a
  client component (Recharts is client-only) — `AnalyticsTrendChart.tsx`
  (`'use client'`), fed the already-fetched `series` as a prop.

### 5. `src/components/admin/AnalyticsLiveCount.tsx` — client component

- `'use client'`. Fetches `/api/admin/analytics` on mount and every 60s.
- Renders "X online nu" with a small pulsing dot. Hidden/zeroed gracefully on
  error. Clears its interval on unmount.

## Data flow

```
Browser (admin) ──GET /admin──▶ page.tsx (server)
                                  ├─ umamiConfigured()? no ─▶ omit section
                                  └─ yes ─▶ getSummary(), getPageviewSeries()
                                              └─ umami.ts ─▶ apiBase() ─▶ Umami API
                                                   (token cache, breaker, timeouts)
AnalyticsLiveCount (client) ──poll /api/admin/analytics/60s──▶ route.ts ─▶ getActiveVisitors()
```

## Error handling

| Failure | Behaviour |
|---------|-----------|
| Required env var missing | `umamiConfigured()` false → section omitted; no throw. |
| Umami unreachable / timeout | Methods return null/0/[]; breaker opens 5 min; section shows `healthCheck()` message; dashboard otherwise unaffected. |
| Login denied (401/403) | Specific health message; section degrades. |
| Website-id invalid / user not linked | Specific health message. |
| Live-count poll fails | Badge hides / shows nothing; no console spam beyond one log. |

## Testing

Unit tests (Vitest, mocked `fetch`) for `src/lib/umami.ts`:
- `umamiConfigured()` true/false on env presence.
- `apiBase()` prefers `UMAMI_INTERNAL_URL`, falls back to `UMAMI_API_URL`.
- `getToken()` logs in once and reuses the cached token within TTL.
- 401 path: `apiGet` re-logins once and retries.
- Circuit breaker: after a transport failure, subsequent calls short-circuit
  without a network call until TTL elapses.
- `parseStats` for both flat and nested shapes; derived bounceRate/avgVisitTime;
  prev extraction from both `comparison` and nested `prev`.
- `normalizeSeries` gap-fills missing days and maps sessions correctly.
- `getActiveVisitors` reads `{ visitors }`; returns 0 on failure.
- `healthCheck` returns the right status/message per scenario.

Route test: `GET /api/admin/analytics` returns 401 (no session) and 403
(non-admin).

## Out of scope (v1)

- Top pages / referrers / country / device breakdowns.
- Date-range picker (fixed 30 days).
- Replacing the hardcoded values in the public tracking tag with env vars.
- Sharing the token/breaker cache across workers via Redis (in-memory per-worker
  is sufficient; re-login is cheap at a 6h TTL).
