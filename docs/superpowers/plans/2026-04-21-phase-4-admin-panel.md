# Phase 4 — Admin Panel, Email Notifications & CMS
*Date: 2026-04-21*

## Goal
Build the Dutch-only admin panel, email notifications for social events, Pages CMS, landing page CMS, cookie consent banner, and the pending played-game approvals view.

## Reference
- Spec: `docs/superpowers/specs/2026-04-16-dice-vault-design.md` §4, §12, §14–§17
- Reference UI: `reference/admin.html`
- All new routes under `/admin/` — Dutch-only, no i18n library, role guard (`role === 'admin'`)

---

## Task 1 — Admin layout & auth guard
**Files:** `src/app/admin/layout.tsx`, `src/components/layout/AdminSidebar.tsx`, `src/middleware.ts`

- Admin layout wraps all `/admin/**` routes; Dutch-only (no `useTranslations`)
- AdminSidebar: nav links — Dashboard, Gebruikers, Instellingen, Landing, Pagina's, Billing (Billing placeholder for Phase 5)
- Middleware: extend existing admin guard to check `session.user.role === 'admin'` — redirect to `/en/auth/login` if not
- Admin dashboard (`/admin/page.tsx`): placeholder KPI cards (total users, total played games, total credit transactions) — pull simple counts from Prisma

---

## Task 2 — User management
**Files:** `src/app/admin/users/page.tsx`, `src/app/admin/users/[id]/page.tsx`, `src/app/admin/users/actions.ts`

- List page: search by email/username, paginate 50/page, show credit balance (monthly + permanent), role badge, lifetime free badge, requiresMfa badge
- Detail/edit page per user:
  - Toggle `isLifetimeFree`
  - Toggle `requiresMfa`
  - Change `role` (user ↔ admin)
  - Manual credit adjustment: +/- with reason text → inserts CreditTransaction, updates User credits

---

## Task 3 — Admin settings
**Files:** `src/app/admin/settings/page.tsx`, `src/app/admin/settings/actions.ts`, `src/app/admin/settings/discount-codes/page.tsx`, `src/app/admin/settings/discount-codes/actions.ts`

**Settings page** — edit AdminSettings keys:
- `monthly_free_credits` (default 75)
- `cost_game_template`, `cost_league`, `cost_add_player`, `cost_played_game`
- `low_credit_threshold`
- `free_mode_active` (boolean toggle)
- `free_mode_banner_nl`, `free_mode_banner_en` (text)

**Discount codes** — full CRUD for `DiscountCode` model:
- Fields: code, type (FIXED/PERCENT), value, usageLimit (optional), expiresAt (optional), active toggle
- List shows usedCount/usageLimit
- Cannot delete codes with `usedCount > 0` (deactivate instead)

---

## Task 4 — Landing page CMS (admin)
**Files:** `src/app/admin/landing/page.tsx`, `src/app/admin/landing/actions.ts`, `src/app/admin/landing/reviews/page.tsx`, `src/app/admin/landing/reviews/actions.ts`

**Landing CMS** — edit AdminSettings keys `landing_hero`, `landing_features`, `landing_cta`, `landing_footer`:
- Hero: headline (nl/en), subheadline (nl/en), primary CTA label (nl/en), secondary CTA label (nl/en), badge text (nl/en)
- Features: 3 cards with icon (Lucide name), title (nl/en), description (nl/en)
- CTA banner: headline (nl/en), body (nl/en), button label (nl/en)
- Footer: tagline (nl/en)

**Update landing page** to read from DB (Redis cache 10-min TTL) — fall back to current hardcoded strings if key absent.

**Reviews CRUD** — list (with drag-order), create, edit, delete, toggle visible.

---

## Task 5 — Pages CMS
**Files:** `src/app/admin/pages/page.tsx`, `src/app/admin/pages/[id]/page.tsx`, `src/app/admin/pages/actions.ts`, `src/app/[locale]/p/[slug]/page.tsx`, migration for seeding system pages

**Admin pages list** — CRUD for `Page` model:
- System pages (terms, privacy, why-bitcoin): cannot delete, locked icon
- Create/edit: slug, titleNl, titleEn, contentNl (Markdown), contentEn (Markdown), published toggle
- `order` field controls footer link order

**Public pages** at `/[locale]/p/[slug]`:
- Server-rendered, reads `Page` by slug, renders correct locale
- Markdown → HTML via `react-markdown` + `remark-gfm`
- 404 if `published: false` or slug not found
- Uses marketing layout (same header/footer as landing)

**Migration** — seed system pages (terms, privacy, why-bitcoin) with placeholder content.

**Footer** — add published pages links sorted by `order`.

---

## Task 6 — Cookie consent banner
**Files:** `src/components/layout/CookieBanner.tsx`, `src/app/[locale]/layout.tsx`, `messages/nl/common.json`, `messages/en/common.json`

- Soft bottom bar on all `[locale]/**` marketing pages only
- "Accept" button + link to `/[locale]/p/privacy`
- Preference stored in `localStorage` key `cookie_consent`; banner hidden once set
- Copy in `common.cookieBanner.{text,accept,privacyLink}`

---

## Task 7 — Email notifications
**Files:** `src/lib/mail.ts` (extend), `messages/nl/emails.json`, `messages/en/emails.json`, trigger sites in existing actions

Send Mailgun email on:
| Event | Recipient | Template key |
|---|---|---|
| Connection request received | `toUser` | `emails.connection_request` |
| Connection request accepted | `fromUser` | `emails.connection_accepted` |
| PlayedGame submitted (pending) | league owner | `emails.played_game_pending` |
| PlayedGame approved | submitter | `emails.played_game_approved` |
| PlayedGame rejected | submitter | `emails.played_game_rejected` |

Each email: subject + short body with a link back to the app. Both nl/en. Send in user's `locale`.

---

## Task 8 — Admin played game approvals view
**Files:** `src/app/admin/approvals/page.tsx`, `src/app/admin/approvals/actions.ts`

- List all `PlayedGame` with `status === 'pending_approval'` across all users, sorted newest first
- Show: league name, submitter email, played date, player scores
- Admin can approve or reject from this view (same logic as owner — updates status, creates notification, sends email)

---

## Task 9 — README update
**File:** `README.md`

- Add Phase 4 entry to changelog
- No new env vars
- Note: first admin user must be promoted via `prisma studio` or seed script (document the SQL one-liner)
