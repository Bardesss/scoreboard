# Dice Vault — Credits, Free Mode & Analytics Design
*Date: 2026-04-17*

---

## Overview

This spec covers four related enhancements to the credit system:
1. **Split credit pools** — monthly credits (resets, can go negative) vs. permanent credits (bought/given, never resets)
2. **Free mode** — immediate toggle + scheduled free periods with editable banner text
3. **Credit wallet UI** — breakdown display, negative balance styling, ∞ for lifetime free users
4. **Credit analytics** — platform-level charts + per-user drill-down in admin

---

## 1. Data model changes

### Modified: `User`

Replace `credits Int @default(75)` with two separate pools:

```prisma
monthlyCredits   Int @default(75)  // resets monthly; can go negative in free mode
permanentCredits Int @default(0)   // bought + admin-given; never resets; never negative
```

### Modified: `CreditTransaction`

Add `pool` column to attribute each transaction to the correct pool:

```prisma
pool String @default("monthly")  // "monthly" | "permanent"
```

A single action may produce two `CreditTransaction` rows if it splits across pools (e.g. monthly drained to 0, remainder from permanent).

### New: `FreePeriod`

```prisma
model FreePeriod {
  id           String   @id @default(cuid())
  label        String
  startsAt     DateTime
  endsAt       DateTime
  bannerTextNl String   @default("Gratis periode actief — gebruik zoveel je wilt")
  bannerTextEn String   @default("Free period active — use as much as you like")
  createdAt    DateTime @default(now())
}
```

Validation: `endsAt > startsAt`. No overlapping periods allowed.

### Modified: `AdminSettings` seed

New keys:

```
{ key: "free_mode_active",       value: false }
{ key: "free_mode_banner_nl",    value: "Gratis periode actief — gebruik zoveel je wilt" }
{ key: "free_mode_banner_en",    value: "Free period active — use as much as you like" }
```

---

## 2. Free mode resolution

Free mode is active when **either** condition is true:

- `AdminSettings["free_mode_active"] === true`, OR
- `now()` falls within any `FreePeriod` where `startsAt <= now <= endsAt`

This check lives in `src/lib/credits.ts` as `isFreeModeActive(): Promise<boolean>`.

The active banner text is resolved as:
- If the immediate toggle is on → use `free_mode_banner_nl` / `free_mode_banner_en` from `AdminSettings`
- If inside a scheduled `FreePeriod` → use that period's `bannerTextNl` / `bannerTextEn`, with " — ends [date]" appended automatically

---

## 3. Credit deduction logic

`deductCredits(userId, action, meta)` in `src/lib/credits.ts`:

```
1. Fetch { monthlyCredits, permanentCredits, isLifetimeFree } from User
2. If isLifetimeFree → return { newMonthly: monthlyCredits, newPermanent: permanentCredits } (no deduction)
3. Check isFreeModeActive()
4. cost = await getActionCost(action)
5. Deduction order — monthly first:

   Case A: monthlyCredits >= cost
     → deduct cost from monthly only
     → 1 CreditTransaction { pool: "monthly", delta: -cost }

   Case B: monthlyCredits > 0 AND monthlyCredits < cost
     → drain monthly to 0 (partial = monthlyCredits)
     → remainder = cost - partial
     → if permanentCredits >= remainder:
         deduct remainder from permanent
         → 2 CreditTransactions: { pool: "monthly", delta: -partial }, { pool: "permanent", delta: -remainder }
       else if freeModeActive:
         drain permanent to 0, monthly goes negative by (remainder - permanentCredits)
         → 2 CreditTransactions: monthly goes to -(remainder - permanentCredits), permanent to 0
       else:
         throw InsufficientCreditsError

   Case C: monthlyCredits <= 0
     → deduct entirely from permanent
     → if permanentCredits >= cost:
         → 1 CreditTransaction { pool: "permanent", delta: -cost }
       else if freeModeActive:
         drain permanent to 0, monthly goes further negative
         → transactions split accordingly
       else:
         throw InsufficientCreditsError

6. All balance updates + CreditTransaction inserts run in a Prisma $transaction
7. Return { newMonthly, newPermanent }
```

### Monthly reset (cron)

The credit reset cron (`/api/cron/credit-reset`) only resets `monthlyCredits` to the configured `monthly_free_credits` value. `permanentCredits` is never touched by the cron.

### Free period end cleanup

The monthly credit reset cron (`/api/cron/credit-reset`) also handles free period end cleanup: for every user where `monthlyCredits < 0` and free mode is currently **inactive**, set `monthlyCredits = 0`. This runs on the same cron schedule as the monthly reset (checked each run, not just on reset day). `permanentCredits` untouched.

---

## 4. Free mode admin UI (`/admin/settings/free-mode`)

### Immediate toggle section
- On/off toggle: "Free Mode Active"
- When on: warning banner in admin — "All users are in free mode. Credits are still deducted but negative monthly balances are allowed."
- Editable banner text fields: Dutch + English (saved to `AdminSettings`)

### Scheduled free periods section
- Table of all `FreePeriod` records:

| Label | Starts | Ends | Status | Actions |
|---|---|---|---|---|
| Christmas Week | 24 Dec 00:00 | 27 Dec 23:59 | upcoming | Edit / Delete |
| Launch Week | 1 May 00:00 | 7 May 23:59 | active | — |
| New Year 2025 | 1 Jan 00:00 | 1 Jan 23:59 | ended | — |

- Status badge: `upcoming` (grey) / `active` (green) / `ended` (muted)
- **Create**: form with label, start datetime, end datetime, banner text (nl + en). Validates no overlap with existing periods.
- **Edit**: only future (`upcoming`) periods can be edited
- **Delete**: only `upcoming` periods can be deleted. Active + ended are archived (read-only)

---

## 5. Free mode banner in app

Mounted in `src/app/app/layout.tsx` (authenticated app shell only — not marketing pages).

**Behaviour:**
- Rendered server-side: check `isFreeModeActive()` and resolve banner text + end date
- If free mode active: shows a dismissible banner at the top of the app
  - Immediate toggle active: shows custom banner text (no end date)
  - Scheduled period active: shows period's banner text + "— ends [formatted date]"
- Dismissed state stored in `sessionStorage` key `free_banner_dismissed` — reappears on next browser session if still active
- Banner uses the primary color scheme from design tokens

**i18n:** banner text comes from DB (per `FreePeriod` or `AdminSettings`), so it's already locale-aware. No `next-intl` keys needed for the text content itself.

---

## 6. Credit wallet UI

Located in `src/components/shared/CreditChip.tsx` (existing component, updated).

| State | Display |
|---|---|
| `isLifetimeFree` | ∞ symbol, no numbers, primary color |
| Normal, positive | Total balance (monthly + permanent) as headline number |
| Normal, negative | Total balance in error color `#9f403d` (e.g. `-12`) |

**Breakdown tooltip/popout** (on hover desktop, on tap mobile):
```
Monthly:   45 credits
Permanent: 120 credits
─────────────────────
Total:     165 credits
```

If monthly is negative:
```
Monthly:   -12 credits  ← shown in error color
Permanent: 120 credits
─────────────────────
Total:     108 credits
```

**Low credit warning**: triggers when `monthlyCredits + permanentCredits < low_credit_threshold`. Does not trigger for `isLifetimeFree` users.

---

## 7. Credit analytics (`/admin/credits`)

### Platform overview tab

**Charts** (using Recharts, same as dashboard):

| Chart | Type | X-axis | Y-axis |
|---|---|---|---|
| Credits spent by action | Bar | Date | Credits spent, grouped by action type |
| Monthly credits: issued vs spent | Line | Date | Credits issued (reset) vs credits spent from monthly pool |
| Permanent credits: sold vs spent | Line | Date | Credits added via purchase vs credits spent from permanent pool |

- Period selector: 7d / 30d / 90d / custom date range
- Active free periods shown as **shaded vertical regions** on all charts
- Data source: `CreditTransaction` aggregated by date + `reason` + `pool`

### Per-user table tab

Columns: Email | Monthly balance | Permanent balance | Total spent (all time) | Last action | Flags

- **Flags**: `⚠ negative` when `monthlyCredits < 0`, `∞` when `isLifetimeFree`
- Sortable by any column
- Searchable by email

**User detail view** (click a row):
- Full `CreditTransaction` log for that user
- Columns: Date | Action | Pool | Delta | Running balance (monthly) | Running balance (permanent)
- Paginated, 50 rows per page

---

## 8. Credit gifting

Players can send permanent credits to other players by username or email address.

### Flow

1. Sender opens **Gift Credits** from the credit wallet (or user profile page of the recipient).
2. Enters recipient's **username or email** — live lookup resolves and shows the display name + avatar to confirm the right person.
3. Enters the **amount** to gift (minimum: 1, maximum: sender's current `permanentCredits` balance).
4. Confirms — two `CreditTransaction` rows are written in a single `$transaction`:
   - Sender: `{ pool: "permanent", delta: -amount, reason: "gift_sent", meta: { recipientId } }`
   - Recipient: `{ pool: "permanent", delta: +amount, reason: "gift_received", meta: { senderId } }`
5. Recipient's `permanentCredits` increases immediately. Sender cannot gift credits they don't have.

### Constraints

- Only `permanentCredits` can be gifted — monthly credits cannot be transferred.
- Sender cannot gift to themselves.
- If the lookup finds no account for the given username/email, show a clear error: "No account found."
- Gift amount is deducted atomically; no partial success.

### Data model

No new model needed. The existing `CreditTransaction` with `reason: "gift_sent"` / `"gift_received"` and `meta` JSON covering the counterparty is sufficient.

### UI entry points

| Location | Entry |
|---|---|
| Credit wallet popout | "Gift credits" button |
| Another user's profile page | "Gift credits" button (pre-fills recipient) |

### Admin visibility

Gift transactions appear in the per-user `CreditTransaction` log with reason badge `gift_sent` / `gift_received` and the counterparty's email shown in the meta column.

---

## 9. Terms of Service additions

The Terms of Service system page must include:

- During free periods, credits are still deducted as normal. Monthly credits may go negative.
- When a free period ends, any negative monthly credit balance is reset to zero. Positive monthly balances and all permanent (purchased/gifted) credits are unaffected.
- Permanent credits (purchased, admin-granted, or gifted by another player) never expire and are never reset by the monthly cycle.
- Credits can be gifted to other players. Only permanent credits can be gifted; monthly credits cannot be transferred.

---

## 9. Phase placement

| Phase | Work |
|---|---|
| **2** | Split `credits` → `monthlyCredits` + `permanentCredits` on `User`; add `pool` to `CreditTransaction`; update `deductCredits()` and monthly reset cron |
| **4** | Admin free mode toggle + scheduled free periods UI; credit wallet breakdown; free period banner in app; credit gifting UI (wallet + profile entry points) |
| **6** | Credit analytics dashboard (`/admin/credits`); free period end cleanup in cron; Terms additions |
