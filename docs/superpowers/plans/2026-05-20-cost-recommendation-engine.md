# Cost Recommendation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a `/admin/settings/recommendations` page that suggests a calibrated `monthly_free_credits` allowance, derived from real `CreditTransaction` usage history, via 4 comparable scenarios with one-click apply.

**Architecture:** Two pure-ish lib modules — `costAnalytics.ts` (aggregates spend per active user from `CreditTransaction`, plus a percentile primitive) and `costRecommendations.ts` (turns analytics into per-scenario allowance recommendations). A server component computes analytics for the 30/60/90-day windows up front; a client component lets the admin switch window and apply a scenario via a server action that re-derives the value server-side and writes `AdminSettings`.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, Vitest, `sonner` toasts.

**Spec:** `docs/superpowers/specs/2026-05-19-free-mode-and-cost-recommendations-design.md` §3 (Phase 2).

---

## Spec deviation (decided up front)

The spec §4 lists an `admin.recommendations` i18n namespace for `messages/{en,nl}/app.json`.
However, **every existing `/admin/*` page uses hardcoded Dutch strings** — none call
`getTranslations`/`t()` (see `src/app/admin/settings/page.tsx`,
`src/app/admin/landing/page.tsx`). Spec §3.71 itself says the admin panel is Dutch-only.
This plan follows the actual codebase pattern: the recommendations page and client use
**hardcoded Dutch strings**. No translation keys are added; `messages/*/app.json` is not
modified.

---

## File Structure

**Create:**
- `src/lib/admin/costAnalytics.ts` — `percentile()` primitive; `loadCostAnalytics(windowDays)`; `getDaysOfActivity()`
- `src/lib/admin/costAnalytics.test.ts`
- `src/lib/admin/costRecommendations.ts` — `recommendForScenario()`, `ceilTo5()`, the `Scenario` type
- `src/lib/admin/costRecommendations.test.ts`
- `src/app/admin/settings/recommendations/actions.ts` — `applyScenario()` server action
- `src/test/recommendations-actions.test.ts`
- `src/app/admin/settings/recommendations/page.tsx` — server component, computes all windows
- `src/app/admin/settings/recommendations/RecommendationsClient.tsx` — client UI (window switch, cards, apply)

**Modify:**
- `src/app/admin/settings/SettingsClient.tsx` — add a link card to the recommendations page

The two lib modules have a clean dependency direction: `costRecommendations.ts` imports
`percentile` + the `CostAnalytics` type from `costAnalytics.ts`. Nothing imports back.

---

## Task 1: `costAnalytics.ts` — percentile + analytics loaders

**Files:**
- Create: `src/lib/admin/costAnalytics.ts`
- Test: `src/lib/admin/costAnalytics.test.ts`

TDD task.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin/costAnalytics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creditTransaction: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { percentile, loadCostAnalytics, getDaysOfActivity } from './costAnalytics'

const DAY_MS = 24 * 60 * 60 * 1000

describe('percentile', () => {
  it('returns 0 for an empty array', () => {
    expect(percentile([], 50)).toBe(0)
  })
  it('returns the only value for a single-element array', () => {
    expect(percentile([7], 90)).toBe(7)
  })
  it('computes the median with linear interpolation', () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25)
  })
  it('computes p75 and p25 with linear interpolation', () => {
    expect(percentile([10, 20, 30, 40], 75)).toBe(32.5)
    expect(percentile([10, 20, 30, 40], 25)).toBe(17.5)
  })
  it('sorts the input before computing', () => {
    expect(percentile([40, 10, 30, 20], 50)).toBe(25)
  })
})

describe('loadCostAnalytics', () => {
  beforeEach(() => vi.clearAllMocks())

  const rows = [
    { userId: 'u1', delta: -5, reason: 'played_game' },
    { userId: 'u1', delta: -10, reason: 'league' },
    { userId: 'u2', delta: -25, reason: 'game_template' },
    { userId: 'u2', delta: -5, reason: 'played_game' },
  ]

  it('aggregates total spend and per-action counts per user', async () => {
    vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue(rows as never)
    const result = await loadCostAnalytics(30)

    const u1 = result.activeUsers.find(u => u.userId === 'u1')
    const u2 = result.activeUsers.find(u => u.userId === 'u2')
    expect(u1).toEqual({ userId: 'u1', totalSpend: 15, actionCounts: { played_game: 1, league: 1 } })
    expect(u2).toEqual({ userId: 'u2', totalSpend: 30, actionCounts: { game_template: 1, played_game: 1 } })
  })

  it('computes per-action percentiles over row-level spend', async () => {
    vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue(rows as never)
    const result = await loadCostAnalytics(30)

    const playedGame = result.perAction.find(a => a.reason === 'played_game')
    expect(playedGame).toEqual({ reason: 'played_game', p25: 5, p50: 5, p75: 5, p90: 5, mean: 5 })
  })

  it('queries only spend rows from non-lifetime-free users within the window', async () => {
    vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue([] as never)
    await loadCostAnalytics(30)
    expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          delta: { lt: 0 },
          user: { isLifetimeFree: false },
        }),
      })
    )
  })

  it('returns a window spanning windowDays', async () => {
    vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue([] as never)
    const result = await loadCostAnalytics(60)
    const span = result.windowEnd.getTime() - result.windowStart.getTime()
    expect(Math.round(span / DAY_MS)).toBe(60)
  })
})

describe('getDaysOfActivity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 0 when there are no transactions', async () => {
    vi.mocked(prisma.creditTransaction.findFirst).mockResolvedValue(null)
    expect(await getDaysOfActivity()).toBe(0)
  })

  it('returns whole days since the earliest transaction', async () => {
    vi.mocked(prisma.creditTransaction.findFirst).mockResolvedValue(
      { createdAt: new Date(Date.now() - 25 * DAY_MS) } as never
    )
    expect(await getDaysOfActivity()).toBe(25)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin/costAnalytics.test.ts`
Expected: FAIL — module `./costAnalytics` does not exist.

- [ ] **Step 3: Implement `src/lib/admin/costAnalytics.ts`**

```ts
import { prisma } from '@/lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

export type ActiveUserStats = {
  userId: string
  totalSpend: number
  actionCounts: Record<string, number>
}

export type PerActionStats = {
  reason: string
  p25: number
  p50: number
  p75: number
  p90: number
  mean: number
}

export type CostAnalytics = {
  activeUsers: ActiveUserStats[]
  perAction: PerActionStats[]
  windowStart: Date
  windowEnd: Date
}

/**
 * Linear-interpolation percentile (PERCENTILE.INC / R-7). `p` is 0-100.
 * Sorts a copy of the input; returns 0 for an empty array.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const rank = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}

/**
 * Aggregate credit-spend over a rolling window. "Active user" = a non-lifetime-free
 * user with at least one negative-delta CreditTransaction in the window. Top-ups,
 * refunds and monthly resets (positive deltas) are excluded.
 */
export async function loadCostAnalytics(windowDays: number): Promise<CostAnalytics> {
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - windowDays * DAY_MS)

  const rows = await prisma.creditTransaction.findMany({
    where: {
      createdAt: { gte: windowStart, lte: windowEnd },
      delta: { lt: 0 },
      user: { isLifetimeFree: false },
    },
    select: { userId: true, delta: true, reason: true },
  })

  const byUser = new Map<string, ActiveUserStats>()
  const spendByReason = new Map<string, number[]>()

  for (const row of rows) {
    const spend = Math.abs(row.delta)

    let user = byUser.get(row.userId)
    if (!user) {
      user = { userId: row.userId, totalSpend: 0, actionCounts: {} }
      byUser.set(row.userId, user)
    }
    user.totalSpend += spend
    user.actionCounts[row.reason] = (user.actionCounts[row.reason] ?? 0) + 1

    const amounts = spendByReason.get(row.reason) ?? []
    amounts.push(spend)
    spendByReason.set(row.reason, amounts)
  }

  const perAction: PerActionStats[] = [...spendByReason.entries()].map(([reason, amounts]) => ({
    reason,
    p25: percentile(amounts, 25),
    p50: percentile(amounts, 50),
    p75: percentile(amounts, 75),
    p90: percentile(amounts, 90),
    mean: amounts.reduce((sum, a) => sum + a, 0) / amounts.length,
  }))

  return { activeUsers: [...byUser.values()], perAction, windowStart, windowEnd }
}

/** Whole days elapsed since the earliest CreditTransaction in the system (0 if none). */
export async function getDaysOfActivity(): Promise<number> {
  const earliest = await prisma.creditTransaction.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
  if (!earliest) return 0
  return Math.floor((Date.now() - earliest.createdAt.getTime()) / DAY_MS)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin/costAnalytics.test.ts`
Expected: PASS — all tests.

Also run `npx tsc --noEmit` and confirm no new errors in the two files (pre-existing unrelated `src/test/*.test.ts` errors — ignore).

- [ ] **Step 5: Commit**

```
git add src/lib/admin/costAnalytics.ts src/lib/admin/costAnalytics.test.ts
git commit -m "feat(admin): cost analytics — percentile, spend aggregation, activity window"
```

---

## Task 2: `costRecommendations.ts` — scenario engine

**Files:**
- Create: `src/lib/admin/costRecommendations.ts`
- Test: `src/lib/admin/costRecommendations.test.ts`

TDD task.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin/costRecommendations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { CostAnalytics } from './costAnalytics'
import { recommendForScenario, ceilTo5 } from './costRecommendations'

function analyticsWithSpends(spends: number[]): CostAnalytics {
  return {
    activeUsers: spends.map((totalSpend, i) => ({
      userId: `u${i}`,
      totalSpend,
      actionCounts: {},
    })),
    perAction: [],
    windowStart: new Date(),
    windowEnd: new Date(),
  }
}

describe('ceilTo5', () => {
  it('rounds up to the nearest multiple of 5', () => {
    expect(ceilTo5(0)).toBe(0)
    expect(ceilTo5(1)).toBe(5)
    expect(ceilTo5(25)).toBe(25)
    expect(ceilTo5(32.5)).toBe(35)
  })
})

describe('recommendForScenario', () => {
  const analytics = analyticsWithSpends([10, 20, 30, 40])
  const current = 50

  it('conservative — p75 of spend, rounded up to 5', () => {
    const r = recommendForScenario('conservative', analytics, current)
    expect(r).toEqual({
      monthlyFreeCredits: 35,
      predictedPositiveCount: 3,
      totalActiveUsers: 4,
      medianRemainingAtRecommended: 10,
    })
  })

  it('balanced — p50 of spend, rounded up to 5', () => {
    const r = recommendForScenario('balanced', analytics, current)
    expect(r).toEqual({
      monthlyFreeCredits: 25,
      predictedPositiveCount: 2,
      totalActiveUsers: 4,
      medianRemainingAtRecommended: 0,
    })
  })

  it('aggressive — p25 of spend, rounded up to 5', () => {
    const r = recommendForScenario('aggressive', analytics, current)
    expect(r).toEqual({
      monthlyFreeCredits: 20,
      predictedPositiveCount: 2,
      totalActiveUsers: 4,
      medianRemainingAtRecommended: -5,
    })
  })

  it('status_quo — keeps the current allowance', () => {
    const r = recommendForScenario('status_quo', analytics, current)
    expect(r).toEqual({
      monthlyFreeCredits: 50,
      predictedPositiveCount: 4,
      totalActiveUsers: 4,
      medianRemainingAtRecommended: 25,
    })
  })

  it('handles a single active user (percentiles collapse to that user)', () => {
    const r = recommendForScenario('conservative', analyticsWithSpends([30]), 50)
    expect(r).toEqual({
      monthlyFreeCredits: 30,
      predictedPositiveCount: 1,
      totalActiveUsers: 1,
      medianRemainingAtRecommended: 0,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin/costRecommendations.test.ts`
Expected: FAIL — module `./costRecommendations` does not exist.

- [ ] **Step 3: Implement `src/lib/admin/costRecommendations.ts`**

```ts
import { type CostAnalytics, percentile } from './costAnalytics'

export type Scenario = 'conservative' | 'balanced' | 'aggressive' | 'status_quo'

export type ScenarioRecommendation = {
  monthlyFreeCredits: number
  predictedPositiveCount: number
  totalActiveUsers: number
  medianRemainingAtRecommended: number
}

/** Round up to the nearest multiple of 5 — keeps recommended allowances readable. */
export function ceilTo5(n: number): number {
  return Math.ceil(n / 5) * 5
}

/**
 * Recommend a `monthly_free_credits` allowance for one scenario, derived from the
 * distribution of per-user spend. Per-action costs are never adjusted — keeping them
 * constant means the predicted-positive counts are comparable across scenarios.
 */
export function recommendForScenario(
  scenario: Scenario,
  analytics: CostAnalytics,
  currentMonthlyCredits: number,
): ScenarioRecommendation {
  const spends = analytics.activeUsers.map(u => u.totalSpend)

  let monthlyFreeCredits: number
  if (scenario === 'conservative') monthlyFreeCredits = ceilTo5(percentile(spends, 75))
  else if (scenario === 'balanced') monthlyFreeCredits = ceilTo5(percentile(spends, 50))
  else if (scenario === 'aggressive') monthlyFreeCredits = ceilTo5(percentile(spends, 25))
  else monthlyFreeCredits = currentMonthlyCredits // status_quo

  const predictedPositiveCount = spends.filter(s => s <= monthlyFreeCredits).length
  const medianRemainingAtRecommended = monthlyFreeCredits - percentile(spends, 50)

  return {
    monthlyFreeCredits,
    predictedPositiveCount,
    totalActiveUsers: spends.length,
    medianRemainingAtRecommended,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin/costRecommendations.test.ts`
Expected: PASS — all tests.

Also run `npx tsc --noEmit` — no new errors in the two files.

- [ ] **Step 5: Commit**

```
git add src/lib/admin/costRecommendations.ts src/lib/admin/costRecommendations.test.ts
git commit -m "feat(admin): cost recommendation scenario engine"
```

---

## Task 3: `applyScenario` server action

**Files:**
- Create: `src/app/admin/settings/recommendations/actions.ts`
- Test: `src/test/recommendations-actions.test.ts`

TDD task.

- [ ] **Step 1: Write the failing tests**

Create `src/test/recommendations-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/admin/costAnalytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/costAnalytics')>()),
  loadCostAnalytics: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { loadCostAnalytics } from '@/lib/admin/costAnalytics'
import { applyScenario } from '@/app/admin/settings/recommendations/actions'

const admin = { user: { id: 'a1', email: 'a@x.com', locale: 'en', role: 'admin' } }

const analytics = {
  activeUsers: [
    { userId: 'u1', totalSpend: 20, actionCounts: {} },
    { userId: 'u2', totalSpend: 40, actionCounts: {} },
  ],
  perAction: [],
  windowStart: new Date(),
  windowEnd: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(admin as never)
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'monthly_free_credits', value: 75 } as never)
  vi.mocked(loadCostAnalytics).mockResolvedValue(analytics as never)
})

describe('applyScenario', () => {
  it('rejects a non-admin caller', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    expect(await applyScenario('balanced', 30)).toEqual({ ok: false, error: 'unauthorized' })
    expect(prisma.adminSettings.upsert).not.toHaveBeenCalled()
  })

  it('no-ops for status_quo (writes nothing, returns current value)', async () => {
    const result = await applyScenario('status_quo', 30)
    expect(result).toEqual({ ok: true, newValue: 75 })
    expect(prisma.adminSettings.upsert).not.toHaveBeenCalled()
  })

  it('writes the recommended monthly_free_credits for a real scenario', async () => {
    // balanced → p50 of [20,40] = 30 → ceilTo5 = 30
    const result = await applyScenario('balanced', 30)
    expect(result).toEqual({ ok: true, newValue: 30 })
    expect(prisma.adminSettings.upsert).toHaveBeenCalledWith({
      where: { key: 'monthly_free_credits' },
      update: { value: 30 },
      create: { key: 'monthly_free_credits', value: 30 },
    })
  })

  it('returns ok:false on an unexpected failure', async () => {
    vi.mocked(loadCostAnalytics).mockRejectedValue(new Error('db down'))
    expect(await applyScenario('balanced', 30)).toEqual({ ok: false, error: 'unknown' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/recommendations-actions.test.ts`
Expected: FAIL — module `@/app/admin/settings/recommendations/actions` does not exist.

- [ ] **Step 3: Implement `src/app/admin/settings/recommendations/actions.ts`**

```ts
'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadCostAnalytics } from '@/lib/admin/costAnalytics'
import { recommendForScenario, type Scenario } from '@/lib/admin/costRecommendations'

export type ApplyScenarioResult =
  | { ok: true; newValue: number }
  | { ok: false; error: string }

const MONTHLY_CREDITS_KEY = 'monthly_free_credits'
const MONTHLY_CREDITS_DEFAULT = 75
const ALLOWED_WINDOWS = [30, 60, 90]

async function isAdmin(): Promise<boolean> {
  const session = await auth()
  return !!session && session.user.role === 'admin'
}

async function readCurrentMonthlyCredits(): Promise<number> {
  const row = await prisma.adminSettings.findUnique({ where: { key: MONTHLY_CREDITS_KEY } })
  return typeof row?.value === 'number' ? row.value : MONTHLY_CREDITS_DEFAULT
}

/**
 * Apply a scenario's recommended `monthly_free_credits` to AdminSettings. The value is
 * re-derived server-side from `scenario` + `windowDays` — a client-supplied number is
 * never trusted. `status_quo` is a no-op (it means "keep current settings").
 */
export async function applyScenario(
  scenario: Scenario,
  windowDays: number,
): Promise<ApplyScenarioResult> {
  if (!(await isAdmin())) return { ok: false, error: 'unauthorized' }

  try {
    const current = await readCurrentMonthlyCredits()
    if (scenario === 'status_quo') {
      return { ok: true, newValue: current }
    }

    const window = ALLOWED_WINDOWS.includes(windowDays) ? windowDays : 30
    const analytics = await loadCostAnalytics(window)
    const { monthlyFreeCredits } = recommendForScenario(scenario, analytics, current)

    await prisma.adminSettings.upsert({
      where: { key: MONTHLY_CREDITS_KEY },
      update: { value: monthlyFreeCredits as Prisma.InputJsonValue },
      create: { key: MONTHLY_CREDITS_KEY, value: monthlyFreeCredits as Prisma.InputJsonValue },
    })

    revalidatePath('/admin/settings/recommendations')
    revalidatePath('/admin/settings')
    return { ok: true, newValue: monthlyFreeCredits }
  } catch (e) {
    console.error('[recommendations] applyScenario failed', e)
    return { ok: false, error: 'unknown' }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/recommendations-actions.test.ts`
Expected: PASS — 4 tests.

Also run `npx tsc --noEmit` — no new errors in `actions.ts` / `recommendations-actions.test.ts`.

- [ ] **Step 5: Commit**

```
git add src/app/admin/settings/recommendations/actions.ts src/test/recommendations-actions.test.ts
git commit -m "feat(admin): applyScenario action writes recommended allowance"
```

---

## Task 4: Recommendations page + client UI

No React component render tests exist in this codebase (Vitest runs in the `node`
environment), so this task is verified by type-check + manual check. The page is a server
component; the admin layout already enforces the admin-only guard for `/admin/*`, and
`applyScenario` re-checks admin — so the page needs no extra guard.

**Files:**
- Create: `src/app/admin/settings/recommendations/RecommendationsClient.tsx`
- Create: `src/app/admin/settings/recommendations/page.tsx`

- [ ] **Step 1: Create the client component**

Create `src/app/admin/settings/recommendations/RecommendationsClient.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Scenario, ScenarioRecommendation } from '@/lib/admin/costRecommendations'
import { applyScenario } from './actions'

export type WindowData = {
  windowDays: number
  activeUserCount: number
  scenarios: Record<Scenario, ScenarioRecommendation>
}

export type RecommendationsClientProps = {
  windows: WindowData[]
  daysOfActivity: number
  currentMonthlyCredits: number
  currentCosts: { game_template: number; league: number; add_player: number; played_game: number }
}

const MIN_ACTIVE_USERS = 10
const MIN_DAYS = 21

const SCENARIO_ORDER: Scenario[] = ['conservative', 'balanced', 'aggressive', 'status_quo']

const SCENARIO_META: Record<Scenario, { label: string; desc: string }> = {
  conservative: { label: 'Conservatief', desc: 'Alleen de top 25% van gebruikers zou credits moeten kopen.' },
  balanced: { label: 'Gebalanceerd', desc: 'De helft van de gebruikers komt uit met het maandelijkse tegoed.' },
  aggressive: { label: 'Agressief', desc: 'De meeste gebruikers zouden credits moeten kopen.' },
  status_quo: { label: 'Huidige instelling', desc: 'Huidige instellingen ongewijzigd laten.' },
}

const COST_LABELS: Record<keyof RecommendationsClientProps['currentCosts'], string> = {
  game_template: 'Speltemplate',
  league: 'Competitie',
  add_player: 'Speler toevoegen',
  played_game: 'Game loggen',
}

const cardBg = '#161f28'
const border = '1px solid rgba(255,255,255,0.07)'
const textColor = 'rgba(255,255,255,0.87)'
const mutedColor = 'rgba(255,255,255,0.45)'

export function RecommendationsClient({
  windows,
  daysOfActivity,
  currentMonthlyCredits,
  currentCosts,
}: RecommendationsClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [windowDays, setWindowDays] = useState<number>(windows[0]?.windowDays ?? 30)

  const active = windows.find(w => w.windowDays === windowDays) ?? windows[0]
  const gateOk = active.activeUserCount >= MIN_ACTIVE_USERS && daysOfActivity >= MIN_DAYS

  function onApply(scenario: Scenario, newValue: number) {
    if (!window.confirm(`Maandelijkse credits wijzigen van ${currentMonthlyCredits} naar ${newValue}?`)) {
      return
    }
    startTransition(async () => {
      const result = await applyScenario(scenario, windowDays)
      if (result.ok) {
        toast.success('Tegoed bijgewerkt. De volgende maandelijkse cron-tick gebruikt de nieuwe waarde.')
        router.refresh()
      } else {
        toast.error('Er ging iets mis. Probeer het opnieuw.')
      }
    })
  }

  return (
    <div>
      {/* Window selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <label htmlFor="window" style={{ fontSize: 13, color: mutedColor }}>
          Tijdvenster
        </label>
        <select
          id="window"
          value={windowDays}
          onChange={e => setWindowDays(Number(e.target.value))}
          style={{
            background: cardBg,
            color: textColor,
            border,
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
          }}
        >
          {windows.map(w => (
            <option key={w.windowDays} value={w.windowDays}>
              Laatste {w.windowDays} dagen
            </option>
          ))}
        </select>
      </div>

      {!gateOk ? (
        <div style={{ background: cardBg, border, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: textColor, marginBottom: 8 }}>
            Nog niet genoeg data
          </div>
          <p style={{ fontSize: 13.5, color: mutedColor, margin: 0, lineHeight: 1.6 }}>
            Aanbevelingen hebben minimaal {MIN_ACTIVE_USERS} actieve gebruikers en {MIN_DAYS} dagen
            activiteit nodig om betekenisvol te zijn. Op dit moment:{' '}
            <strong style={{ color: textColor }}>{active.activeUserCount} actieve gebruikers</strong>
            {' · '}
            <strong style={{ color: textColor }}>{daysOfActivity} dagen activiteit</strong>.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {SCENARIO_ORDER.map(scenario => {
            const rec = active.scenarios[scenario]
            const meta = SCENARIO_META[scenario]
            const isCurrent = rec.monthlyFreeCredits === currentMonthlyCredits
            const diff = rec.monthlyFreeCredits - currentMonthlyCredits
            const isRecommended = scenario === 'balanced'

            return (
              <div
                key={scenario}
                style={{
                  background: cardBg,
                  border: isRecommended ? '1px solid rgba(245,166,35,0.35)' : border,
                  borderRadius: 16,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: textColor }}>{meta.label}</div>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#4a8eff',
                        background: 'rgba(74,142,255,0.12)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Huidig
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: mutedColor, margin: 0, lineHeight: 1.5 }}>{meta.desc}</p>

                <div>
                  <div style={{ fontSize: 12, color: mutedColor }}>Maandelijks tegoed</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: textColor }}>
                    {rec.monthlyFreeCredits}
                    {diff !== 0 && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: mutedColor, marginLeft: 6 }}>
                        ({diff > 0 ? '+' : ''}{diff})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 4 }}>Kosten per actie (ongewijzigd):</div>
                  {(Object.keys(COST_LABELS) as Array<keyof typeof COST_LABELS>).map(key => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{COST_LABELS[key]}</span>
                      <span style={{ color: textColor }}>{currentCosts[key]}</span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: 12.5,
                    color: textColor,
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    lineHeight: 1.5,
                  }}
                >
                  <div>
                    <strong>{rec.predictedPositiveCount} van {rec.totalActiveUsers}</strong> actieve
                    gebruikers zouden op ≥0 credits eindigen.
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Mediane gebruiker houdt <strong>{rec.medianRemainingAtRecommended}</strong> credits over.
                  </div>
                </div>

                {isCurrent ? (
                  <div style={{ fontSize: 12, color: mutedColor, textAlign: 'center', padding: '8px 0' }}>
                    Actieve instelling
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onApply(scenario, rec.monthlyFreeCredits)}
                    disabled={pending}
                    style={{
                      background: isRecommended ? '#f5a623' : '#005bc0',
                      color: isRecommended ? '#0b0d12' : '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '9px 16px',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: pending ? 'not-allowed' : 'pointer',
                      opacity: pending ? 0.6 : 1,
                    }}
                  >
                    Dit scenario toepassen
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the page**

Create `src/app/admin/settings/recommendations/page.tsx`:

```tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { loadCostAnalytics, getDaysOfActivity } from '@/lib/admin/costAnalytics'
import { recommendForScenario, type Scenario, type ScenarioRecommendation } from '@/lib/admin/costRecommendations'
import { RecommendationsClient, type WindowData } from './RecommendationsClient'

const WINDOWS = [30, 60, 90]
const SCENARIOS: Scenario[] = ['conservative', 'balanced', 'aggressive', 'status_quo']

const DEFAULTS = {
  monthly_free_credits: 75,
  cost_game_template: 25,
  cost_league: 10,
  cost_add_player: 10,
  cost_played_game: 5,
}

export default async function RecommendationsPage() {
  const rows = await prisma.adminSettings.findMany()
  const raw: Record<string, unknown> = {}
  for (const row of rows) raw[row.key] = row.value
  const num = (key: string, fallback: number) =>
    typeof raw[key] === 'number' ? (raw[key] as number) : fallback

  const currentMonthlyCredits = num('monthly_free_credits', DEFAULTS.monthly_free_credits)
  const currentCosts = {
    game_template: num('cost_game_template', DEFAULTS.cost_game_template),
    league: num('cost_league', DEFAULTS.cost_league),
    add_player: num('cost_add_player', DEFAULTS.cost_add_player),
    played_game: num('cost_played_game', DEFAULTS.cost_played_game),
  }

  const daysOfActivity = await getDaysOfActivity()

  const windows: WindowData[] = []
  for (const windowDays of WINDOWS) {
    const analytics = await loadCostAnalytics(windowDays)
    const scenarios = {} as Record<Scenario, ScenarioRecommendation>
    for (const scenario of SCENARIOS) {
      scenarios[scenario] = recommendForScenario(scenario, analytics, currentMonthlyCredits)
    }
    windows.push({ windowDays, activeUserCount: analytics.activeUsers.length, scenarios })
  }

  return (
    <div>
      <Link
        href="/admin/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={15} /> Terug naar Instellingen
      </Link>

      <h1
        className="font-headline"
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.87)',
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}
      >
        Kostenaanbevelingen
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
        Gekalibreerde adviezen voor het maandelijkse tegoed, op basis van echt verbruik.
        Kosten per actie blijven ongewijzigd — die beheer je in Instellingen.
      </p>

      <RecommendationsClient
        windows={windows}
        daysOfActivity={daysOfActivity}
        currentMonthlyCredits={currentMonthlyCredits}
        currentCosts={currentCosts}
      />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `page.tsx` or `RecommendationsClient.tsx`. Pre-existing unrelated `src/test/*.test.ts` errors — ignore.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in as admin, visit `/admin/settings/recommendations` directly.
With little usage data the minimum-data gate panel shows (`N active users · D days`).
Switching the window dropdown updates the gate numbers. If you have enough seeded data,
the 4 scenario cards render; "Dit scenario toepassen" prompts a confirm and, on accept,
shows a success toast and the page refreshes.

- [ ] **Step 5: Commit**

```
git add src/app/admin/settings/recommendations/page.tsx src/app/admin/settings/recommendations/RecommendationsClient.tsx
git commit -m "feat(admin): cost recommendations page with 4 scenario cards"
```

---

## Task 5: Link card on the Settings page

**Files:**
- Modify: `src/app/admin/settings/SettingsClient.tsx`

`SettingsClient.tsx` already renders an "Integraties" link card (a `<Link>` styled with the
shared `cardStyle`). Add a matching "Kostenaanbevelingen" card right after it.

- [ ] **Step 1: Add the recommendations link card**

In `src/app/admin/settings/SettingsClient.tsx`, find the closing `</Link>` of the
Integrations shortcut block followed by the submit button — this block:

```tsx
        <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</span>
      </Link>

      <button
        type="submit"
```

Replace it with:

```tsx
        <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</span>
      </Link>

      {/* Cost recommendations shortcut */}
      <Link
        href="/admin/settings/recommendations"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          ...cardStyle,
          textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ ...cardTitleStyle, marginBottom: 4 }}>Kostenaanbevelingen</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Advies voor het maandelijkse tegoed op basis van verbruik
          </div>
        </div>
        <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</span>
      </Link>

      <button
        type="submit"
```

(`Link` is already imported in this file; `cardStyle` and `cardTitleStyle` are already
defined and used by the Integrations card.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `SettingsClient.tsx`.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, sign in as admin, open `/admin/settings`. A "Kostenaanbevelingen" card
appears below the "Integraties" card; clicking it navigates to
`/admin/settings/recommendations`.

- [ ] **Step 4: Commit**

```
git add src/app/admin/settings/SettingsClient.tsx
git commit -m "feat(admin): link to cost recommendations from settings"
```

---

## Final Verification

- [ ] **Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the three new files (`costAnalytics.test.ts`,
`costRecommendations.test.ts`, `recommendations-actions.test.ts`).

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors in any file this plan created or modified.
