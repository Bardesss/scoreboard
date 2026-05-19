# Dice Vault — Free-mode UX + Cost Recommendations Design
*Date: 2026-05-19*

---

## Overview

Dice Vault is live without payment providers configured. Users can already drop into negative credits, but the current UI still shows an alarming "credits almost depleted — buy more" banner that has no payment flow behind it. Meanwhile, an admin (`free_mode_active`) toggle and editable `free_mode_banner_*` text fields already exist in `/admin/settings` but **nothing in the app or on the landing page actually renders them**. Half the infrastructure is built; the consumer is missing.

This spec covers two related but independently-shippable pieces of work:

1. **Free-mode banner** — render the existing admin-configured banner in the app shell and on the landing page when `free_mode_active === true`. Suppress the low-credit warning while free mode is on. Dismissible with a 7-day reappearance. Soften pricing-related copy on the landing page (since "credit packs at €X" feels off when the app is currently free).

2. **Cost recommendation engine** — when enough usage data has accumulated, give the admin a `/admin/settings/recommendations` page that surfaces 4 pre-baked scenarios for what `monthly_free_credits` should be, derived from real `CreditTransaction` history. One-click apply writes the chosen scenario's value into `AdminSettings`. The admin keeps full control of individual costs in `/admin/settings`; the recommendations page just gives them a calibrated starting allowance.

The two phases ship in any order. They share one helper (`loadFreeModeState`) and one new translation namespace.

---

## 1. Implementation plans

| Plan | Scope |
|---|---|
| **Plan 1 — Free-mode banner** | `src/lib/freeMode.ts` helper, `FreeModeBanner` app component (suppresses `LowCreditBanner` when active), 7-day localStorage dismissal, `FreeModeRibbon` on the landing page, soft-adapted copy on landing's `credits.costs` + `packs` sections, one-line admin-side hint in `/admin/settings`, default banner text seed. |
| **Plan 2 — Cost recommendation engine** | `costAnalytics.ts` + `costRecommendations.ts` lib modules with TDD, `/admin/settings/recommendations` page with 4 scenario cards, "Apply" server action that writes the chosen scenario's `monthly_free_credits` to `AdminSettings`, minimum-data gate, link card on `/admin/settings`. |

Plan 1 is small (≈1 helper, 1 component, 1 ribbon, light layout edits). Plan 2 is medium (≈2 lib modules with tests, 1 admin page + client + action). Neither depends on the other; both can ship in any order.

---

## 2. Phase 1 — Free-mode banner

### 2.1 Trigger & state

Single trigger: the existing `AdminSettings` row `free_mode_active === true`. When that's true:
- The free-mode banner renders (app shell + landing ribbon).
- The low-credit banner is **suppressed entirely** — even if the user is below the low-credit threshold, the alarming "buy credits" banner doesn't appear. This is the headline change.
- The landing page softens its `credits.costs` and `packs` sections (see §2.5).

No new schema, no new admin settings — the toggle and banner-text fields already exist (see `prisma/seed.ts` and `src/app/admin/settings/SettingsClient.tsx`).

### 2.2 Shared loader: `src/lib/freeMode.ts`

```ts
export async function loadFreeModeState(): Promise<{
  active: boolean
  bannerNl: string
  bannerEn: string
}>
```

Single read of three `AdminSettings` rows (`free_mode_active`, `free_mode_banner_nl`, `free_mode_banner_en`). Returns falsy defaults if any are missing — the consumer falls back to translated defaults from i18n when text is empty (§2.7). Used by both the app layout and the marketing page; deduplicates the lookup logic and keeps the gating behavior consistent.

### 2.3 App banner: `src/components/credits/FreeModeBanner.tsx`

Drops into the same fixed-top slot as the existing `LowCreditBanner` in `src/app/app/layout.tsx`. The layout's conditional becomes:

```tsx
if (freeMode.active)            → <FreeModeBanner text={...} />
else if (isLow)                 → <LowCreditBanner ... />
else                            → nothing
```

The two are mutually exclusive; the layout's main-content padding logic stays the same (banner present → pushed down).

**Visual:**
- Friendly amber (`#f5a623` brand, lighter than `LowCreditBanner`'s `#c47f00` warning amber)
- Banner text + small `×` close button on the right
- Single line on desktop; wraps gracefully on mobile

**Text source priority:**
1. Admin-edited text from `free_mode_banner_{locale}` if non-empty
2. Translated default from `app.freeMode.defaultBannerText` (i18n) — used so the banner never shows blank if admin leaves the field empty

### 2.4 Dismissal — 7-day localStorage cooldown

Single client-side key: `localStorage['dvFreeModeBannerDismissedAt'] = <ISO date>`.

On mount, the component reads the key:
- Missing or older than 7 days → banner shows
- Within the last 7 days → banner hidden

Dismiss button writes `new Date().toISOString()`. Same key is shared between the app banner (§2.3) and the landing ribbon (§2.5a) — dismissing in one place hides it in both for 7 days. This is by design: same user, same message, no point asking twice.

**Why localStorage, not a User column:**
- Cooldown is 7 days, not lifetime — small ergonomic value to syncing across devices
- Anonymous landing-page visitors don't have a User row anyway
- Cheap to ship, easy to remove later if persisted dismissal becomes desirable

### 2.5 Landing page changes — `src/app/[locale]/(marketing)/page.tsx`

When `freeMode.active === true`, two changes:

**(a) Top ribbon (`FreeModeRibbon`)** — thin amber strip above the existing hero. Anonymous-visible, dismissible (same 7-day key as §2.4). Renders the same banner text used in the app, integrated into the marketing design (matches the page's existing card chrome + amber accent palette, not a tacked-on browser-notification look).

**(b) Pricing sections soften** — the existing `credits.costs` (per-action prices) and `packs` (credit pack pricing) sections stay visible (they preview what's coming), but each gets a small overline badge:

| Section | Overline when free mode is on |
|---|---|
| `credits.costs` | *"Pilot values — will be tuned before billing turns on"* |
| `packs` | *"Coming when billing turns on"* |

Hero, features, how-it-works, group features, payment methods are unchanged.

### 2.6 Admin-side tweaks — `/admin/settings`

Single one-line hint added above the existing "Gratis modus" card (which already contains the `free_mode_active` toggle and banner-text inputs):

> *"When active: the low-credit warning is hidden, the free-mode banner appears in the app and on the landing page."*

`prisma/seed.ts` already seeds default banner text (`"Gratis periode actief — gebruik zoveel je wilt"` / `"Free period active — use as much as you like"`). Update those seed values to include the adjustability hint, e.g.:

- nl: `"Gratis te gebruiken — kosten per actie en maandelijks tegoed worden later afgestemd."`
- en: `"Currently free to use — action costs and monthly allowance will be tuned before billing turns on."`

Existing rows in production with the old default text are left as-is (admins editing them already overrode). New deployments / dev DBs get the better defaults.

### 2.7 Translation keys

New `app.freeMode.*` namespace in `messages/{en,nl}/app.json`:

```json
"freeMode": {
  "defaultBannerText": "Currently free to use — action costs and monthly allowance will be tuned before billing turns on.",
  "dismissAria": "Dismiss"
}
```

New `landing.freeMode.*` namespace in `messages/{en,nl}/landing.json`:

```json
"freeMode": {
  "costsPilotBadge": "Pilot values — will be tuned before billing turns on",
  "packsComingBadge": "Coming when billing turns on"
}
```

Dutch mirrors. The admin-edited banner text is rendered raw (not a translation key) — admin picks the locale variant; the loader returns both.

### 2.8 Files

**New**
- `src/lib/freeMode.ts`
- `src/components/credits/FreeModeBanner.tsx`
- `src/app/[locale]/(marketing)/_components/FreeModeRibbon.tsx`

**Modified**
- `src/app/app/layout.tsx` — load free-mode state, conditional render (FreeModeBanner vs LowCreditBanner vs nothing)
- `src/app/[locale]/(marketing)/page.tsx` — load free-mode state, render ribbon, pass active flag to pricing sections
- `src/app/admin/settings/SettingsClient.tsx` — one-line hint above "Gratis modus" card
- `prisma/seed.ts` — better default banner text values (idempotent: existing rows aren't overwritten by the `upsert(update: {})` pattern already in place)
- `messages/en/app.json`, `messages/nl/app.json` — `freeMode` namespace
- `messages/en/landing.json`, `messages/nl/landing.json` — `freeMode` namespace

### 2.9 Edge cases

| Scenario | Behavior |
|---|---|
| Admin flips `free_mode_active` from true → false | Layout re-renders on next request; FreeModeBanner gone, LowCreditBanner returns if user is below threshold. No special dismissal handling — localStorage key just becomes irrelevant until free mode is next enabled. |
| Admin clears both `free_mode_banner_{nl,en}` fields | Banner shows the translated default from `app.freeMode.defaultBannerText`. |
| User dismisses, then admin changes the banner text within 7 days | Banner stays hidden for the full 7 days (we don't version dismissal by banner content — too clever for the value). |
| Anonymous visitor on landing, then logs in within 7 days | Banner stays dismissed in app too (same localStorage key, same browser). |
| User clears browser data | localStorage key gone → banner reappears. Acceptable. |
| Landing page hit from a user already logged in | They get redirected to `/app/dashboard` per existing logic — they only see the app banner, not the ribbon. |

---

## 3. Phase 2 — Cost recommendation engine

### 3.1 Goal

Help the admin choose `monthly_free_credits` (and, if they want to hand-tune, individual `cost_*` values) **before flipping payments on**, based on real `CreditTransaction` history from the free-mode period. The admin can keep refining until they like the predicted-positive-user count.

### 3.2 Approach — 4 pre-baked scenarios

Each scenario answers *"if I want N% of users to comfortably stay positive on the monthly allowance, what should it be?"* by picking a different percentile of observed monthly spend per active user.

| Scenario | Who pays under these settings | `monthly_free_credits` formula | When to use |
|---|---|---|---|
| **Conservative** | Top 25% of users only | `ceilTo5(p75(activeUserMonthlySpend))` | Generous onboarding; defer revenue. |
| **Balanced** | Top 50% (median user breaks even) | `ceilTo5(p50(activeUserMonthlySpend))` | Sustainable default — half free, half paying. |
| **Aggressive** | Top 75% (only light users stay free) | `ceilTo5(p25(activeUserMonthlySpend))` | Revenue-first. |
| **Status quo** | Whatever the current settings produce | current `monthly_free_credits` (unchanged) | Baseline for comparison. |

Per-action costs (`cost_game_template`, `cost_league`, `cost_add_player`, `cost_played_game`) are **not** auto-adjusted by any scenario. Keeping the current ratios constant means the admin only has to evaluate one knob (the allowance), and the predicted-positive counts are directly comparable across scenarios. The admin remains free to hand-edit individual costs in `/admin/settings` after applying a scenario.

`ceilTo5` rounds up to the nearest multiple of 5 — keeps recommended values human-readable (75 → 80, not 77).

### 3.3 Each scenario card shows

- Recommended `monthly_free_credits` value (e.g. `75 → 120 (+45)`)
- Per-action cost table (current values, shown for clarity — labeled "unchanged")
- **Predicted impact**: *"Under these settings, **N of M** active users would have ended last month at ≥0 credits."*
- **Median user outcome**: *"Median user would have ended with **X** credits remaining."*
- **"Apply this scenario"** button (primary on the recommended scenario, secondary on others)

The currently-active scenario (matching current settings) is highlighted with a small "Current" chip, not a button.

### 3.4 Algorithm

```ts
// src/lib/admin/costAnalytics.ts

type ActiveUserStats = {
  userId: string
  totalSpend: number               // sum of |delta| over rows where delta < 0
  actionCounts: Record<string, number>  // per-reason counts of rows where delta < 0
}

export async function loadCostAnalytics(windowDays: number): Promise<{
  activeUsers: ActiveUserStats[]
  perAction: Array<{ reason: string; p25: number; p50: number; p75: number; p90: number; mean: number }>
  windowStart: Date
  windowEnd: Date
}>
```

- **Window**: `windowEnd = now`, `windowStart = now - windowDays × 24h` (rolling window, not calendar months). `CreditTransaction.createdAt` is filtered `>= windowStart AND <= windowEnd`.
- **Active user** = any user with ≥1 `CreditTransaction` row in the window where `delta < 0` (i.e. they spent credits). Only those rows count toward `totalSpend` and `actionCounts` — top-ups, refunds, and monthly cron resets (positive deltas) are ignored.
- **Lifetime-free users** (`User.isLifetimeFree === true`) are **excluded** entirely — they don't affect billing decisions.
- **Pool isn't filtered** — monthly and permanent deductions both count toward `totalSpend`.

```ts
// src/lib/admin/costRecommendations.ts

type Scenario = 'conservative' | 'balanced' | 'aggressive' | 'status_quo'

export function recommendForScenario(
  scenario: Scenario,
  analytics: Awaited<ReturnType<typeof loadCostAnalytics>>,
  currentMonthlyCredits: number,
): {
  monthlyFreeCredits: number
  predictedPositiveCount: number
  totalActiveUsers: number
  medianRemainingAtRecommended: number
}
```

For each scenario:
1. Compute the target percentile of `activeUsers.totalSpend`
2. Round up to nearest 5 → recommended allowance
3. Predict: count of `activeUsers` where `totalSpend <= recommendedAllowance` (those who would have ended positive)
4. Median remaining: `recommendedAllowance - p50(activeUsers.totalSpend)`

Status quo uses `currentMonthlyCredits` directly.

### 3.5 Time window

Default: **last 30 days** (rolling, defined as `now - 30 × 24h` through `now`). Dropdown to switch to 60 or 90 days. No "since free mode started" option in v1 — `AdminSettings` doesn't track when the toggle flipped on, and adding timestamps is more work than the value justifies. 30/60/90 covers the relevant analysis range.

Window selection is a UI-only state — no URL param, no persistence. Reloading the page resets to 30 days.

### 3.6 Minimum-data gate

Don't surface recommendations until there's enough signal. Show a friendly panel instead when either condition fails:
- Fewer than 10 active users in the window
- Free mode hasn't been active for at least 21 days (proxied by: fewer than 21 days have elapsed since the earliest `CreditTransaction` row in the system — close enough for v1)

Panel content:

> **Not enough data yet.**
> Recommendations need at least **10 active users** and **21 days** of activity to be meaningful.
> Currently: **{N} active users · {D} days of activity**.
> Come back once both pass.

The two numbers update on each page load so the admin can see progress.

### 3.7 Apply flow

"Apply this scenario" → confirm dialog showing the exact change (e.g. *"Change monthly free credits from 75 to 120?"*) → server action `applyScenario(scenario)` writes to `AdminSettings`. Toast: *"Allowance updated. Next monthly cron tick uses the new value."*

Important: this **does not** flip `free_mode_active` off. That's a deliberate separate decision — see §5.

### 3.8 Surface

New page at `/admin/settings/recommendations`. Linked from `/admin/settings` with a card-style entry (mirroring the existing "Integraties" link card pattern, see `src/app/admin/settings/SettingsClient.tsx`). The link card is visible whenever the recommendations page exists — not gated by free mode (an admin might want to peek at the data even without flipping the free-mode switch).

### 3.9 Files

**New**
- `src/lib/admin/costAnalytics.ts`
- `src/lib/admin/costAnalytics.test.ts`
- `src/lib/admin/costRecommendations.ts`
- `src/lib/admin/costRecommendations.test.ts`
- `src/app/admin/settings/recommendations/page.tsx`
- `src/app/admin/settings/recommendations/RecommendationsClient.tsx`
- `src/app/admin/settings/recommendations/actions.ts`
- `src/test/recommendations-actions.test.ts`

**Modified**
- `src/app/admin/settings/SettingsClient.tsx` — add link card to recommendations
- `messages/en/app.json`, `messages/nl/app.json` — admin namespace additions (scenario labels, descriptions, apply-button copy, gate-panel copy)

### 3.10 Tests

- **`costAnalytics.test.ts`** — fixed mock dataset of `CreditTransaction` rows. Asserts: correct per-user totals, correct percentiles, lifetime-free users excluded, window filter respected, users with no spend excluded.
- **`costRecommendations.test.ts`** — given a fixed analytics result, asserts each scenario produces the expected `monthlyFreeCredits`, predicted-positive count, median-remaining. Covers edge case: only one active user (percentiles degenerate).
- **`recommendations-actions.test.ts`** — `applyScenario` server action writes the right key to `AdminSettings`, requires admin role, no-ops for `status_quo`.

### 3.11 Edge cases

| Scenario | Behavior |
|---|---|
| Zero active users in window | Minimum-data gate fires (10-user threshold not met). |
| One active user | Gate fires. (Below 10.) Even if gate were skipped: all percentiles collapse to that user's spend. |
| Heavy outlier (one user logs 500 games/month, rest log 5) | Median still meaningful; p25/p75 still meaningful. The outlier doesn't dominate the percentile calculations. Recommendations are robust. |
| Admin applies "aggressive" then realizes it's too harsh | Re-applies "balanced" — page is non-destructive, can be re-run anytime. |
| Admin applies a scenario, then later changes individual `cost_*` values manually | Fine — the page only writes `monthly_free_credits`. Individual cost edits in `/admin/settings` are independent. |
| Recommendation differs from current by a large factor (e.g. recommended is 5× current) | Show as-is. The admin sees the diff and decides; we don't second-guess the math. |
| Page accessed before any `CreditTransaction` exists at all | Gate's "days of activity" computation returns 0; gate fires; no errors. |

---

## 4. Translation keys (combined)

All new keys, both phases together for reference:

### `messages/{en,nl}/app.json` — `freeMode` namespace

```json
"freeMode": {
  "defaultBannerText": "Currently free to use — action costs and monthly allowance will be tuned before billing turns on.",
  "dismissAria": "Dismiss"
}
```

### `messages/{en,nl}/app.json` — `admin.recommendations` namespace (Plan 2)

```json
"admin": {
  "recommendations": {
    "pageTitle": "Cost recommendations",
    "subtitle": "Based on the last {n} days of usage.",
    "windowDropdownLabel": "Time window",
    "windowOption30": "Last 30 days",
    "windowOption60": "Last 60 days",
    "windowOption90": "Last 90 days",
    "gateTitle": "Not enough data yet",
    "gateBody": "Recommendations need at least 10 active users and 21 days of activity to be meaningful.",
    "gateStatus": "Currently: {users} active users · {days} days of activity.",
    "scenarioConservative": "Conservative",
    "scenarioConservativeDesc": "Only the top 25% of users would need to buy credits.",
    "scenarioBalanced": "Balanced",
    "scenarioBalancedDesc": "Half of users break even on the monthly allowance.",
    "scenarioAggressive": "Aggressive",
    "scenarioAggressiveDesc": "Most users would need to buy credits.",
    "scenarioStatusQuo": "Status quo",
    "scenarioStatusQuoDesc": "Keep current settings unchanged.",
    "recommendedAllowance": "Recommended monthly allowance",
    "predictedPositive": "{n} of {m} active users would end at ≥0 credits",
    "medianRemaining": "Median user would end with {n} credits remaining",
    "applyButton": "Apply this scenario",
    "applyConfirm": "Change monthly free credits from {old} to {new}?",
    "applySuccess": "Allowance updated. Next monthly cron tick uses the new value.",
    "currentChip": "Current",
    "diffLabel": "{old} → {new} ({sign}{delta})"
  }
}
```

### `messages/{en,nl}/landing.json` — `freeMode` namespace

```json
"freeMode": {
  "costsPilotBadge": "Pilot values — will be tuned before billing turns on",
  "packsComingBadge": "Coming when billing turns on"
}
```

Dutch mirrors for all of the above. Admin-side scenario labels (cards) are Dutch-only in `/admin/*` per existing pattern (admin panel is Dutch-only).

---

## 5. Open questions deferred to implementation plan

- **End-of-free-period transition flow.** What happens *the moment* the admin flips `free_mode_active` off? Negative balances need a resolution (zeroed? carried over and made buyable?). The cron-credit-reset behavior already handles month-boundary cleanup, but the transition itself is out of scope for both phases here. Likely a Phase 3 spec.
- **Whether `applyScenario` should snapshot the old value** in a small audit table (`AdminSettingsHistory`) for "who changed what when" visibility. Adds a tiny schema change; YAGNI for v1.
- **Whether the recommendations page should also recommend per-action cost adjustments** (not just allowance). Designed deliberately to NOT do this in v1 — keeping one knob makes scenarios comparable. Revisit if admin requests it.
- **Whether the `loadFreeModeState` helper should cache.** Called once per request on app layout + landing. A request-scoped memo would save one DB roundtrip per render. Probably not worth the complexity in v1.
- **Whether the dismissal cooldown should be admin-configurable.** Currently hardcoded 7 days. If admin wants nag-frequency control, lift to an `AdminSettings` row. Defer until requested.

---

## 6. What this spec deliberately does NOT cover

For future-Bartus reference:

- **Payment-provider integration**. This is post-payments-not-yet-configured UX, not the payment integration itself. Mollie/Stripe/Strike land in Phase 11 of the main roadmap.
- **End-of-free-period balance reconciliation**. See §5 first bullet.
- **Per-user dismissal sync across devices**. localStorage only; cooldown is 7 days, not lifetime.
- **Per-action cost recommendations**. Phase 2 only recommends `monthly_free_credits`; per-action costs stay admin-controlled.
- **Email summary at end of free period**. The recommendations page is on-demand admin UI; no email or report generation.
- **Versioning of dismissal by banner content**. If admin changes the banner mid-cooldown, dismissed users don't re-see it until the 7 days are up.
