# Plan 1 — Free-mode banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `free_mode_active` admin toggle + `free_mode_banner_{nl,en}` text fields to actually render a banner in the app shell and on the landing page. Suppress the alarming "low credits" banner while free mode is on. Soften pricing-section copy on the landing page. 7-day localStorage dismissal shared across surfaces.

**Architecture:** One shared loader (`src/lib/freeMode.ts`) reads the three relevant `AdminSettings` rows. Two presentational components consume it: `FreeModeBanner` (app shell, replaces `LowCreditBanner` when active) and `FreeModeRibbon` (landing page, anonymous-visible). Both share a single `localStorage` dismissal key with a 7-day cooldown. Marketing page conditionally renders softening badges on its existing `credits.costs` and `packs` subsections. No schema change, no new admin settings.

**Tech Stack:** Next.js 15 App Router (server components + client islands) · Prisma + PostgreSQL · next-intl for i18n · Tailwind v3 · Vitest with mocked Prisma · `lucide-react` icons.

---

## Pre-flight

- [ ] **Verify on `main` with no uncommitted changes.**
   Run: `git status`
   Expected: `On branch main` / `nothing to commit, working tree clean`.

- [ ] **Confirm the dev DB is reachable.**
   Run: `npx prisma migrate status 2>&1 | tail -5`
   Expected: `Database schema is up to date!`. If unreachable, start `docker compose up -d db` first.

- [ ] **Confirm tests pass on a clean tree.**
   Run: `npm test -- --run 2>&1 | tail -5`
   Expected: all green (currently 213 passing).

---

## Task 1 — `loadFreeModeState` helper

**Files:**
- Create: `src/lib/freeMode.ts`
- Create: `src/lib/freeMode.test.ts`

Reads three `AdminSettings` rows (`free_mode_active`, `free_mode_banner_nl`, `free_mode_banner_en`) in a single Prisma query. Returns falsy defaults if any row is missing. The two consumers (app layout, marketing page) each call this once per render.

- [ ] **Step 1: Write the failing test.**

Create `src/lib/freeMode.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { adminSettings: { findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { loadFreeModeState } from '@/lib/freeMode'

beforeEach(() => vi.clearAllMocks())

describe('loadFreeModeState', () => {
  it('returns active=true with both banner texts when all three rows exist', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([
      { key: 'free_mode_active', value: true },
      { key: 'free_mode_banner_nl', value: 'Gratis te gebruiken' },
      { key: 'free_mode_banner_en', value: 'Currently free to use' },
    ] as never)
    const state = await loadFreeModeState()
    expect(state).toEqual({
      active: true,
      bannerNl: 'Gratis te gebruiken',
      bannerEn: 'Currently free to use',
    })
  })

  it('queries only the three relevant keys', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([] as never)
    await loadFreeModeState()
    expect(prisma.adminSettings.findMany).toHaveBeenCalledWith({
      where: { key: { in: ['free_mode_active', 'free_mode_banner_nl', 'free_mode_banner_en'] } },
    })
  })

  it('returns active=false and empty texts when no rows exist', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([] as never)
    expect(await loadFreeModeState()).toEqual({ active: false, bannerNl: '', bannerEn: '' })
  })

  it('returns active=false when the toggle row has a non-boolean value', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([
      { key: 'free_mode_active', value: 'yes' },
    ] as never)
    expect((await loadFreeModeState()).active).toBe(false)
  })

  it('treats non-string banner text values as empty (defensive)', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([
      { key: 'free_mode_active', value: true },
      { key: 'free_mode_banner_nl', value: 42 },
      { key: 'free_mode_banner_en', value: null },
    ] as never)
    const state = await loadFreeModeState()
    expect(state.bannerNl).toBe('')
    expect(state.bannerEn).toBe('')
  })
})
```

- [ ] **Step 2: Run, expect failure.**

Run: `npm test -- --run src/lib/freeMode.test.ts`
Expected: FAIL — `Cannot find module '@/lib/freeMode'`.

- [ ] **Step 3: Implement the helper.**

Create `src/lib/freeMode.ts`:

```typescript
import { prisma } from '@/lib/prisma'

export type FreeModeState = {
  active: boolean
  bannerNl: string
  bannerEn: string
}

const KEYS = ['free_mode_active', 'free_mode_banner_nl', 'free_mode_banner_en'] as const

export async function loadFreeModeState(): Promise<FreeModeState> {
  const rows = await prisma.adminSettings.findMany({
    where: { key: { in: ['free_mode_active', 'free_mode_banner_nl', 'free_mode_banner_en'] } },
  })
  const byKey = new Map<string, unknown>(rows.map(r => [r.key, r.value]))
  return {
    active: byKey.get('free_mode_active') === true,
    bannerNl: typeof byKey.get('free_mode_banner_nl') === 'string' ? (byKey.get('free_mode_banner_nl') as string) : '',
    bannerEn: typeof byKey.get('free_mode_banner_en') === 'string' ? (byKey.get('free_mode_banner_en') as string) : '',
  }
}

// Exported only so consumers don't redeclare the list.
export const FREE_MODE_KEYS = KEYS
```

- [ ] **Step 4: Run, expect pass.**

Run: `npm test -- --run src/lib/freeMode.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/freeMode.ts src/lib/freeMode.test.ts
git commit -m "feat(freeMode): shared loader for free_mode admin settings"
```

---

## Task 2 — `FreeModeBanner` app component + i18n keys

**Files:**
- Create: `src/components/credits/FreeModeBanner.tsx`
- Modify: `messages/en/app.json`
- Modify: `messages/nl/app.json`

The component is a client island (needs `localStorage`). Renders nothing if the dismissal timestamp is less than 7 days old. The 7-day window starts at midnight UTC of the dismissal day (rounding makes "7 days" mean "7 calendar days," not "168 hours from when you clicked").

- [ ] **Step 1: Add the i18n keys.**

In `messages/en/app.json`, add a new top-level `freeMode` key alongside the existing top-level keys (`dashboard`, `stats`, `notifications`, etc.). The exact placement is alphabetical-ish; insert after `social`:

```json
"freeMode": {
  "defaultBannerText": "Currently free to use — action costs and monthly allowance will be tuned before billing turns on.",
  "dismissAria": "Dismiss"
}
```

In `messages/nl/app.json`, add the Dutch sibling:

```json
"freeMode": {
  "defaultBannerText": "Gratis te gebruiken — kosten per actie en maandelijks tegoed worden later afgestemd.",
  "dismissAria": "Sluiten"
}
```

Both must be valid JSON — add a trailing comma to the preceding key if needed.

- [ ] **Step 2: Implement the component.**

Create `src/components/credits/FreeModeBanner.tsx`:

```typescript
'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const DISMISS_KEY = 'dvFreeModeBannerDismissedAt'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000  // 7 days

type Props = {
  text: string
  dismissAriaLabel: string
}

export function FreeModeBanner({ text, dismissAriaLabel }: Props) {
  // Start hidden so SSR markup matches the dismissed case; flip in useEffect.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) {
      setVisible(true)
      return
    }
    const dismissedAt = Date.parse(raw)
    if (Number.isNaN(dismissedAt)) {
      setVisible(true)
      return
    }
    if (Date.now() - dismissedAt >= COOLDOWN_MS) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed top-14 lg:top-0 left-0 right-0 z-30 lg:left-64 flex items-center justify-between gap-3 px-4 py-2"
      style={{ background: '#f5a623', color: '#1c1408' }}
      role="status"
    >
      <span className="font-headline font-semibold text-xs flex-1 min-w-0">{text}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={dismissAriaLabel}
        className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-black/10"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}
```

The `setVisible(false)` initial state avoids a hydration flash showing the banner before the localStorage check runs.

- [ ] **Step 3: Verify the component type-checks.**

Run: `npx tsc --noEmit 2>&1 | grep -i "freeMode" | head -10`
Expected: no errors from `FreeModeBanner.tsx`. Pre-existing unrelated errors are OK.

- [ ] **Step 4: Commit.**

```bash
git add src/components/credits/FreeModeBanner.tsx messages/en/app.json messages/nl/app.json
git commit -m "feat(freeMode): FreeModeBanner app component + i18n keys"
```

---

## Task 3 — Wire `FreeModeBanner` into the app layout

**Files:**
- Modify: `src/app/app/layout.tsx`

Two changes: load free-mode state in parallel with the existing queries, and replace the existing `LowCreditBanner` conditional with a 3-way condition (free mode → free banner, else low → low banner, else nothing).

- [ ] **Step 1: Update the imports + Promise.all + conditional.**

Open `src/app/app/layout.tsx`. Add the import for `loadFreeModeState` near the existing `LowCreditBanner` import:

```typescript
import { LowCreditBanner } from '@/components/credits/LowCreditBanner'
import { FreeModeBanner } from '@/components/credits/FreeModeBanner'
import { loadFreeModeState } from '@/lib/freeMode'
```

Extend the existing `Promise.all` to include the free-mode loader. The current call is:

```typescript
  const [user, linkedPlayer, threshold, unreadCount, recentNotifications, accessibleLeagues] = await Promise.all([
    prisma.user.findUnique({...}),
    prisma.player.findFirst({...}),
    prisma.adminSettings.findUnique({ where: { key: 'low_credit_threshold' } }),
    prisma.notification.count({...}),
    prisma.notification.findMany({...}),
    prisma.league.findMany({...}),
  ])
```

Add `loadFreeModeState()` as a 7th item:

```typescript
  const [user, linkedPlayer, threshold, unreadCount, recentNotifications, accessibleLeagues, freeMode] = await Promise.all([
    prisma.user.findUnique({...}),
    prisma.player.findFirst({...}),
    prisma.adminSettings.findUnique({ where: { key: 'low_credit_threshold' } }),
    prisma.notification.count({...}),
    prisma.notification.findMany({...}),
    prisma.league.findMany({...}),
    loadFreeModeState(),
  ])
```

(Don't change the existing entries; preserve their bodies verbatim.)

After the existing `isLow` calculation, add the free-mode-derived values just before the JSX `return`:

```typescript
  const bannerText = locale === 'nl' ? freeMode.bannerNl : freeMode.bannerEn
  const tFreeMode = await getTranslations({ locale, namespace: 'app.freeMode' })
  const freeModeText = bannerText.trim().length > 0 ? bannerText : tFreeMode('defaultBannerText')
  const dismissAria = tFreeMode('dismissAria')
  const showFreeBanner = freeMode.active
  const showLowBanner = !showFreeBanner && isLow
  const showAnyBanner = showFreeBanner || showLowBanner
```

Replace the existing banner render:

```tsx
      {isLow && <LowCreditBanner message={tCredits('lowBanner')} buttonLabel={tCredits('buyCredits')} />}
```

with the 3-way conditional:

```tsx
      {showFreeBanner && <FreeModeBanner text={freeModeText} dismissAriaLabel={dismissAria} />}
      {showLowBanner && <LowCreditBanner message={tCredits('lowBanner')} buttonLabel={tCredits('buyCredits')} />}
```

And change the `<main>` padding class from `isLow ? ...` to `showAnyBanner ? ...` (same conditional, both banners take the same vertical space):

```tsx
        <main
          className={`lg:ml-64 min-h-screen relative z-10 pb-20 lg:pb-0 px-4 lg:px-7 ${showAnyBanner ? 'pt-[92px] lg:pt-9' : 'pt-14 lg:pt-0'}`}
        >
```

- [ ] **Step 2: Run tests, expect no regression.**

Run: `npm test -- --run 2>&1 | tail -5`
Expected: same passing count as before (no test exercises this layout directly).

- [ ] **Step 3: Type-check the layout change.**

Run: `npx tsc --noEmit 2>&1 | grep -i "app/layout" | head -10`
Expected: no errors from `src/app/app/layout.tsx`.

- [ ] **Step 4: Smoke-test in dev.**

Run the dev server in the background (`npm run dev`, capture bash id), wait ~10s.

Without flipping free mode on, hit `/en/app/dashboard` (curl or browser): the page should render as before — no free banner; low-credit banner appears only if your test user is below the threshold.

Then flip the toggle:

```bash
docker exec -i scoreboard-db-1 psql -U dicevault -d dicevault -c "UPDATE \"AdminSettings\" SET value = 'true'::jsonb WHERE key = 'free_mode_active';"
```

Reload the page. Expect: amber free-mode banner with admin-edited text (or the default if blank), and the low-credit banner gone even for users below the threshold.

Dismiss the banner (click the `×`). Reload. Expect: banner stays hidden (localStorage cooldown active).

Turn free mode back off:

```bash
docker exec -i scoreboard-db-1 psql -U dicevault -d dicevault -c "UPDATE \"AdminSettings\" SET value = 'false'::jsonb WHERE key = 'free_mode_active';"
```

Kill the dev server.

- [ ] **Step 5: Commit.**

```bash
git add src/app/app/layout.tsx
git commit -m "feat(freeMode): render FreeModeBanner in app layout, suppress LowCreditBanner"
```

---

## Task 4 — `FreeModeRibbon` + landing-page integration

**Files:**
- Create: `src/app/[locale]/(marketing)/_components/FreeModeRibbon.tsx`
- Modify: `src/app/[locale]/(marketing)/page.tsx`
- Modify: `messages/en/landing.json`
- Modify: `messages/nl/landing.json`

A landing-specific ribbon sized for the dark marketing palette (`#0b0d12` background, amber accent). Shares the same `dvFreeModeBannerDismissedAt` localStorage key as the app banner, so dismissing in one place hides in both for 7 days. The marketing page conditionally renders the ribbon at the top and adds small "softening" overlines to the `credits.costs` and `packs` subsections when free mode is on.

- [ ] **Step 1: Add the i18n keys.**

In `messages/en/landing.json`, add a new top-level `freeMode` key (sibling of the existing `hero`, `features`, etc.):

```json
"freeMode": {
  "ribbonDefaultText": "Currently free to use — action costs and monthly allowance will be tuned before billing turns on.",
  "dismissAria": "Dismiss",
  "costsPilotBadge": "Pilot values — will be tuned before billing turns on",
  "packsComingBadge": "Coming when billing turns on"
}
```

In `messages/nl/landing.json`:

```json
"freeMode": {
  "ribbonDefaultText": "Gratis te gebruiken — kosten per actie en maandelijks tegoed worden later afgestemd.",
  "dismissAria": "Sluiten",
  "costsPilotBadge": "Pilotwaarden — worden afgestemd voordat facturatie aangaat",
  "packsComingBadge": "Beschikbaar zodra facturatie aanstaat"
}
```

- [ ] **Step 2: Implement the ribbon component.**

Create `src/app/[locale]/(marketing)/_components/FreeModeRibbon.tsx`:

```typescript
'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const DISMISS_KEY = 'dvFreeModeBannerDismissedAt'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

type Props = {
  text: string
  dismissAriaLabel: string
}

export function FreeModeRibbon({ text, dismissAriaLabel }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) { setVisible(true); return }
    const dismissedAt = Date.parse(raw)
    if (Number.isNaN(dismissedAt) || Date.now() - dismissedAt >= COOLDOWN_MS) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="status"
      style={{
        background: 'linear-gradient(90deg, rgba(245,166,35,0.18), rgba(245,166,35,0.10))',
        borderBottom: '1px solid rgba(245,166,35,0.28)',
        color: '#ede8dd',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between gap-3">
        <span className="font-headline font-semibold text-[12px]" style={{ color: '#f5a623' }}>
          {text}
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label={dismissAriaLabel}
          className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-white/5"
          style={{ color: 'rgba(245,166,35,0.7)' }}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire into the marketing page.**

Open `src/app/[locale]/(marketing)/page.tsx`. Add imports near the top (alongside existing `getTranslations`/`prisma` imports):

```typescript
import { loadFreeModeState } from '@/lib/freeMode'
import { FreeModeRibbon } from './_components/FreeModeRibbon'
```

In the `LandingPage` function, just after `const t = await getTranslations('landing')`, add:

```typescript
  const freeMode = await loadFreeModeState()
  const tFreeMode = await getTranslations({ locale, namespace: 'landing.freeMode' })
  const ribbonText = (locale === 'nl' ? freeMode.bannerNl : freeMode.bannerEn).trim()
  const ribbonDisplayText = ribbonText.length > 0 ? ribbonText : tFreeMode('ribbonDefaultText')
```

Find the outermost wrapping element in the returned JSX (the `<div>` or `<main>` that contains everything). Insert the ribbon as the very first child, before the existing hero section:

```tsx
      {freeMode.active && (
        <FreeModeRibbon text={ribbonDisplayText} dismissAriaLabel={tFreeMode('dismissAria')} />
      )}
```

- [ ] **Step 4: Soften the `credits.costs` subsection.**

Still in `src/app/[locale]/(marketing)/page.tsx`, find the "Cost table" block (around the line `{t('credits.costs.title')}`). Just before that `<h3>`, insert a small overline rendered only when `freeMode.active`:

```tsx
              {freeMode.active && (
                <p
                  className="font-headline font-bold text-[10px] uppercase tracking-[.08em] mb-2"
                  style={{ color: '#f5a623', opacity: 0.7 }}
                >
                  {tFreeMode('costsPilotBadge')}
                </p>
              )}
              <h3 className="font-headline font-extrabold text-[16px] tracking-[-0.02em] mb-5" style={{ color: text }}>{t('credits.costs.title')}</h3>
```

- [ ] **Step 5: Soften the `packs` section.**

In the same file, find the `{/* ── Credit Packs ── */}` comment and the `LPSectionHeader` immediately after it (`<LPSectionHeader overline={t('packs.overline')} ... />`). Wrap that header (and only the header) so the overline gets replaced when free mode is on:

Replace:

```tsx
        <LPSectionHeader overline={t('packs.overline')} headline={t('packs.headline')} subheadline={t('packs.subheadline')} />
```

With:

```tsx
        <LPSectionHeader
          overline={freeMode.active ? tFreeMode('packsComingBadge') : t('packs.overline')}
          headline={t('packs.headline')}
          subheadline={t('packs.subheadline')}
        />
```

The headline + subheadline stay; only the overline (the small uppercase line above the headline) swaps when free mode is on.

- [ ] **Step 6: Type-check.**

Run: `npx tsc --noEmit 2>&1 | grep -i "marketing\|FreeModeRibbon" | head -10`
Expected: no errors from the new files or the modified marketing page.

- [ ] **Step 7: Smoke-test.**

Start the dev server. With free mode OFF, hit `/en` and `/nl`: page renders unchanged from current production. With free mode ON (toggle via psql as in Task 3 Step 4), expect:
- Amber ribbon at the very top of the page, anonymous-visible
- The "Cost table" inside the Credits section shows the pilot-values overline above its title
- The "Credit packs" section's overline now reads the "Coming when billing turns on" text
- Dismissing the ribbon hides it (and the app banner stays dismissed too — same localStorage key)

Kill the dev server.

- [ ] **Step 8: Commit.**

```bash
git add src/app/\[locale\]/\(marketing\) messages/en/landing.json messages/nl/landing.json
git commit -m "feat(freeMode): landing ribbon + softened pricing-section copy"
```

---

## Task 5 — Admin-side hint + better default seed text

**Files:**
- Modify: `src/app/admin/settings/SettingsClient.tsx`
- Modify: `prisma/seed.ts`

The admin already has the `free_mode_active` toggle + banner-text inputs in `/admin/settings`. Add one Dutch sentence above the "Gratis modus" card so a new admin understands the behavioral consequence of flipping the toggle. Also update the seed defaults so future fresh DBs ship the better text.

- [ ] **Step 1: Add the hint above the "Gratis modus" card.**

Open `src/app/admin/settings/SettingsClient.tsx`. Find the block that starts with `{/* Card 2: Gratis modus */}` (around the second-to-last card). Immediately before that `<div style={cardStyle}>`, insert a small explanatory paragraph styled consistently with the surrounding dark theme:

```tsx
      <p
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.55)',
          marginBottom: 8,
          marginTop: -4,
          lineHeight: 1.4,
        }}
      >
        Als actief: de waarschuwing voor lage credits is verborgen, en de gratis-modus banner verschijnt in de app en op de landingspagina.
      </p>

      {/* Card 2: Gratis modus */}
```

(Admin panel is Dutch-only per the project's existing pattern — hardcoded Dutch, no i18n key.)

- [ ] **Step 2: Update default banner text in the seed.**

Open `prisma/seed.ts`. Find the two `free_mode_banner_*` entries:

```typescript
    { key: 'free_mode_banner_nl',     value: 'Gratis periode actief — gebruik zoveel je wilt' },
    { key: 'free_mode_banner_en',     value: 'Free period active — use as much as you like' },
```

Replace with the improved defaults (mention adjustability so the admin doesn't have to think about copy):

```typescript
    { key: 'free_mode_banner_nl',     value: 'Gratis te gebruiken — kosten per actie en maandelijks tegoed worden later afgestemd.' },
    { key: 'free_mode_banner_en',     value: 'Currently free to use — action costs and monthly allowance will be tuned before billing turns on.' },
```

The existing `upsert({ ..., update: {} })` pattern means current production rows are not overwritten — only fresh deployments (or seed runs against an empty DB) pick up the new text.

- [ ] **Step 3: Run the seed locally to confirm idempotency.**

Run: `npx prisma db seed 2>&1 | tail -3`
Expected: `Seeded N AdminSettings rows` (no errors). Existing dev-DB rows keep whatever text was already there.

- [ ] **Step 4: Visual check the admin page.**

Start the dev server. As an admin user, visit `/admin/settings`. Expect: a small grey hint sentence sitting just above the "Gratis modus" card. The card itself is unchanged.

Kill the dev server.

- [ ] **Step 5: Commit.**

```bash
git add src/app/admin/settings/SettingsClient.tsx prisma/seed.ts
git commit -m "feat(freeMode): admin hint above the toggle + better default banner text"
```

---

## Post-flight

- [ ] **Run the full test suite.**

Run: `npm test -- --run 2>&1 | tail -5`
Expected: green. Same total pass count as pre-flight + 5 new tests from Task 1 (so previously 213 → now 218).

- [ ] **Type-check.**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no NEW errors. Pre-existing errors in `credits-low-warning`, `games-actions`, `leagues-actions`, `support-actions` test files are unrelated and untouched.

- [ ] **End-to-end smoke in dev.**

Start the dev server. Run through, in order:

1. Free mode OFF: `/en/app/dashboard` and `/en` both render unchanged.
2. Flip `free_mode_active` to `true` via psql.
3. Reload `/en/app/dashboard`: amber free-mode banner appears, low-credit banner suppressed even if user is below threshold.
4. Reload `/en`: amber ribbon appears at the top, pricing-section badges visible.
5. Dismiss the ribbon. Reload `/en/app/dashboard`: banner stays dismissed (shared localStorage key).
6. Wait 7 days (or in DevTools console, run `localStorage.removeItem('dvFreeModeBannerDismissedAt')` and reload): banner reappears.
7. Edit the banner text in `/admin/settings` to a custom string. Reload `/en/app/dashboard`: custom text shows.
8. Clear the banner text fields in `/admin/settings`. Reload: default fallback text shows.
9. Flip `free_mode_active` back to `false`. Reload both: banner + ribbon gone, low-credit banner returns if under threshold.

Kill the dev server.

- [ ] **Update `docs/superpowers/plans/INDEX.md`.**

Add a row above the parked phases:

```markdown
| **Free Mode 1** | [plan-1-free-mode-banner.md](2026-05-19-plan-1-free-mode-banner.md) | done | Free-mode banner in app + landing, suppresses low-credit warning, 7-day dismissal |
```

Commit:

```bash
git add docs/superpowers/plans/INDEX.md
git commit -m "docs(plans): mark Free Mode Plan 1 done in INDEX"
```

- [ ] **Push.**

Per project memory (`feedback_no_prs.md`): merge + push to main directly, no PR.

Run: `git push origin main`
Expected: success. Coolify auto-deploys on push.
