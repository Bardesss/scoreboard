# Dice Vault — Design Spec
*Date: 2026-04-16*

---

## 1. Project overview

**Dice Vault** is a worldwide board game score tracking SaaS. Users log their game group's sessions, track player statistics, and maintain a permanent archive of their game nights. Each user owns their own private vault — players are labels, not accounts.

Monetisation is credit-based (no subscriptions). Users get 75 free credits per month and can buy one-time credit packs via Mollie (EU) or Stripe (global).

**Design reference**: `reference/index.html` (app), `reference/landing.html` (marketing), `reference/admin.html` (admin panel).

**Design guidelines**: All tokens, component specs, typography, shadows, animations, and anti-patterns are documented in `docs/design-guidelines.md`. Every component built in this project must match those guidelines exactly.

---

## 2. Confirmed decisions

| Decision | Choice |
|---|---|
| Project location | `C:\Users\Bartus\Dev\scoreboard` (Next.js scaffolded alongside reference files) |
| CSS framework | Tailwind CSS v3 + shadcn/ui |
| Auth library | NextAuth v5 (Auth.js) |
| i18n library | next-intl |
| Locale routing | `/[locale]/` prefix on marketing + auth routes only; app uses DB-stored locale |
| MFA | Optional for users; admin can enforce per-user via `requiresMfa` flag |
| Multi-tenancy | None — single-tenant, players are labels |
| Phase strategy | Approach B — infrastructure first, then features |

---

## 3. Tech stack

- **Next.js 15+** — App Router, TypeScript
- **Tailwind CSS v3** + shadcn/ui
- **Lucide React** — icons
- **Prisma** + PostgreSQL
- **Redis** (ioredis) — tokens, rate limiting, caching, cron lock
- **NextAuth v5** — Credentials provider + TOTP
- **next-intl** — Dutch (`nl`) + English (`en`) at launch
- **Recharts** — charts in dashboard + admin
- **Zod** + **TanStack Query**
- **Mailgun** (`mailgun.js`)
- **Mollie** (`@mollie/api-client`) + **Stripe** (`stripe`)

---

## 4. Folder structure

```
scoreboard/
├── reference/                  # HTML prototypes — read-only design reference
│   ├── index.html
│   ├── landing.html
│   └── admin.html
├── PROMPT.md
│
├── Dockerfile                  # multi-stage: deps → builder → runner
├── docker-compose.yml          # local dev: next + postgres + redis
├── .env.example
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── messages/                   # next-intl translations
│   ├── nl/
│   │   ├── common.json         # nav, buttons, shared errors
│   │   ├── auth.json
│   │   ├── app.json            # dashboard, players, game wizard, sessions
│   │   ├── landing.json
│   │   └── emails.json
│   └── en/
│       └── (same structure)
│
├── src/
│   ├── app/
│   │   ├── [locale]/           # nl | en — marketing + auth only
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx        # landing page
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   ├── forgot-password/
│   │   │   │   ├── reset-password/
│   │   │   │   └── verify-email/
│   │   │   ├── pricing/
│   │   │   └── p/
│   │   │       └── [slug]/     # public CMS pages (terms, privacy, why-bitcoin, …)
│   │   │
│   │   ├── app/                # authenticated — no locale prefix
│   │   │   ├── layout.tsx      # sidebar + bottom nav shell
│   │   │   ├── dashboard/
│   │   │   ├── players/
│   │   │   ├── games/
│   │   │   │   ├── new/        # game template wizard (3 steps)
│   │   │   │   └── [id]/
│   │   │   ├── sessions/
│   │   │   │   ├── new/        # session logging
│   │   │   │   └── [id]/
│   │   │   ├── credits/        # purchase flow
│   │   │   └── settings/       # profile, MFA setup, locale preference
│   │   │
│   │   ├── admin/              # Dutch-only, separate layout
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx        # analytics dashboard
│   │   │   ├── users/
│   │   │   ├── billing/
│   │   │   ├── pages/          # Pages CMS — CRUD for all Page records
│   │   │   │   └── [id]/       # edit a single page (title + markdown content in nl/en)
│   │   │   └── settings/       # action costs, monthly credits, discount codes
│   │   │
│   │   ├── share/
│   │   │   └── [token]/        # public read-only session result (no auth)
│   │   │
│   │   └── api/
│   │       ├── health/         # GET → { db: ok, redis: ok }
│   │       ├── auth/           # NextAuth v5 handler
│   │       ├── webhooks/
│   │       │   ├── mollie/
│   │       │   └── stripe/
│   │       └── cron/
│   │           └── credit-reset/
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives (auto-generated)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   ├── MobileHeader.tsx
│   │   │   └── AdminSidebar.tsx
│   │   ├── auth/
│   │   ├── game/               # wizard steps, session form
│   │   ├── players/
│   │   ├── dashboard/          # stat cards, leaderboard, charts
│   │   ├── credits/            # balance chip, low-credit banner, pack cards
│   │   └── shared/
│   │       ├── Toast.tsx
│   │       ├── Avatar.tsx      # deterministic initials + color
│   │       └── CreditChip.tsx
│   │
│   ├── lib/
│   │   ├── auth.ts             # NextAuth v5 config
│   │   ├── prisma.ts           # singleton Prisma client
│   │   ├── redis.ts            # ioredis singleton
│   │   ├── credits.ts          # deductCredits(), checkBalance()
│   │   ├── totp.ts             # TOTP helpers (otpauth)
│   │   ├── mail.ts             # Mailgun send helpers
│   │   ├── payments/
│   │   │   ├── mollie.ts
│   │   │   └── stripe.ts
│   │   └── i18n.ts             # next-intl server helpers
│   │
│   ├── middleware.ts           # next-intl locale detection + auth guard
│   └── types/
│       └── index.ts
│
└── docs/
    ├── deployment.md
    └── superpowers/
        └── specs/
            └── 2026-04-16-dice-vault-design.md
```

---

## 5. Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  passwordHash       String
  emailVerified      DateTime?
  locale             String    @default("en")       // "nl" | "en"
  role               String    @default("user")     // "user" | "admin"

  // MFA
  totpSecret         String?
  totpEnabled        Boolean   @default(false)
  totpBackupCodes    String[]  // bcrypt-hashed, consumed on use
  requiresMfa        Boolean   @default(false)      // admin-enforced

  // Credits
  monthlyCredits     Int       @default(75)   // resets monthly; can go negative in free mode
  permanentCredits   Int       @default(0)    // bought + admin-given; never resets
  isLifetimeFree     Boolean   @default(false)

  // Relations
  players            Player[]
  linkedAsPlayer     Player[]            @relation("LinkedPlayer")
  gameTemplates      GameTemplate[]
  ownedLeagues       League[]            @relation("OwnedLeagues")
  playedGames        PlayedGame[]        @relation("SubmittedPlayedGames")
  creditTransactions CreditTransaction[]
  creditPurchases    CreditPurchase[]
  connectionsSent    ConnectionRequest[] @relation("SentRequests")
  connectionsReceived ConnectionRequest[] @relation("ReceivedRequests")
  vaultConnections   VaultConnection[]   @relation("MyConnections")
  connectedToMe      VaultConnection[]   @relation("ConnectedToMe")
  notifications      Notification[]

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

model Player {
  id           String         @id @default(cuid())
  userId       String
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  avatarSeed   String         // hash of name → deterministic color
  linkedUserId String?        // set when this player is a connected vault keeper
  linkedUser   User?          @relation("LinkedPlayer", fields: [linkedUserId], references: [id], onDelete: SetNull)
  scores       ScoreEntry[]
  leagueMembers LeagueMember[]
  createdAt    DateTime       @default(now())
}

model GameTemplate {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  description  String?
  scoringNotes String?
  leagues      League[]
  createdAt    DateTime  @default(now())
}

model League {
  id             String         @id @default(cuid())
  ownerId        String
  owner          User           @relation("OwnedLeagues", fields: [ownerId], references: [id], onDelete: Cascade)
  gameTemplateId String
  gameTemplate   GameTemplate   @relation(fields: [gameTemplateId], references: [id])
  name           String
  description    String?
  members        LeagueMember[]
  playedGames    PlayedGame[]
  connectionRequests ConnectionRequest[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

model LeagueMember {
  id        String   @id @default(cuid())
  leagueId  String
  league    League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  playerId  String
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([leagueId, playerId])
}

model PlayedGame {
  id            String       @id @default(cuid())
  leagueId      String
  league        League       @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  submittedById String
  submittedBy   User         @relation("SubmittedPlayedGames", fields: [submittedById], references: [id])
  playedAt      DateTime
  notes         String?
  shareToken    String?      @unique
  status        String       @default("approved")  // "approved" | "pending_approval" | "rejected"
  scores        ScoreEntry[]
  createdAt     DateTime     @default(now())
}

model ScoreEntry {
  id           String     @id @default(cuid())
  playedGameId String
  playedGame   PlayedGame @relation(fields: [playedGameId], references: [id], onDelete: Cascade)
  playerId     String
  player       Player     @relation(fields: [playerId], references: [id])
  score        Int
}

model ConnectionRequest {
  id          String   @id @default(cuid())
  fromUserId  String
  fromUser    User     @relation("SentRequests", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUserId    String?
  toUser      User?    @relation("ReceivedRequests", fields: [toUserId], references: [id], onDelete: Cascade)
  toEmail     String?
  inviteToken String?  @unique
  context     String   // "player_list" | "league"
  leagueId    String?
  league      League?  @relation(fields: [leagueId], references: [id], onDelete: SetNull)
  status      String   @default("pending")  // "pending" | "accepted" | "declined"
  createdAt   DateTime @default(now())
  expiresAt   DateTime?
}

model VaultConnection {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation("MyConnections", fields: [userId], references: [id], onDelete: Cascade)
  connectedUserId String
  connectedUser   User     @relation("ConnectedToMe", fields: [connectedUserId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())

  @@unique([userId, connectedUserId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // "connection_request" | "connection_accepted" | "connection_declined" | "league_invite" | "league_invite_accepted" | "played_game_pending" | "played_game_accepted" | "played_game_rejected"
  meta      Json?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model CreditTransaction {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  delta     Int      // positive = added, negative = spent
  reason    String   // "monthly_reset" | "game_template" | "session" | "admin_adjustment" | "purchase"
  meta      Json?    // e.g. { sessionId, purchaseId, adminId }
  createdAt DateTime @default(now())
}

model CreditPurchase {
  id              String         @id @default(cuid())
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  pricingRegionId String?
  pricingRegion   PricingRegion? @relation(fields: [pricingRegionId], references: [id])
  provider        String         // "mollie" | "stripe" | "strike"
  externalId      String         @unique  // Mollie order ID or Stripe payment intent ID
  credits         Int
  amountCents     Int
  currency        String         // copied from PricingRegion.currency at checkout time

  // Tax / VAT fields — populated when status transitions to "paid"
  customerCountry    String?     // ISO 3166-1 alpha-2: "NL", "DE", "US", "MX" etc.
  customerVatNumber  String?     // EU VAT number if supplied at checkout (B2B)
  eurAmountCents     Int?        // amount in EUR cents (= amountCents when currency is EUR)
  exchangeRate       Decimal?    // e.g. 1.08 means 1 USD = 0.9259 EUR (null if EUR)
  exchangeRateSource String?     // "ECB" | "Coinbase" | "fixed_1"
  exchangeRateDate   DateTime?   // date the rate was fetched
  vatTreatment       String?     // "NL_21" | "EU_OSS" | "EU_REVERSE_CHARGE" | "EXPORT"
  invoiceNumber      String?     @unique  // sequential: DV-2026-0001

  status          String         @default("pending")  // "pending" | "paid" | "failed"
  meta            Json?          // e.g. { discountCode, discountValue, originalAmountCents }
  createdAt       DateTime       @default(now())
}

model PricingRegion {
  id        String   @id @default(cuid())
  name      String                        // "European Union", "Latin America", etc.
  currency  String                        // ISO 4217: "EUR", "USD", "GBP", "BRL", etc.
  symbol    String                        // "€", "$", "£", "R$", etc.
  locales   String[]                      // Accept-Language prefixes: ["nl","fr","de"]
  provider  String   @default("stripe")   // "mollie" | "stripe"
  packs     Json                          // [{ credits: 100, priceCents: 499 }, …]
  isDefault Boolean  @default(false)      // fallback when no locale matches
  active    Boolean  @default(true)
  order     Int      @default(0)          // display order in admin
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  purchases CreditPurchase[]
}

// Seed regions:
// EU          → EUR €  locales:[nl,fr,de,es,it,pt,pl,da,sv,fi,cs,hu,ro,el,bg]  provider:mollie  default:false
// N. America  → USD $  locales:[en-us,en-ca]                                    provider:stripe  default:false
// Lat. America→ USD $  locales:[es-mx,es-ar,es-co,es-cl,pt-br]                 provider:stripe  default:false
// Asia-Pacific→ USD $  locales:[zh,ja,ko,th,vi,id,ms]                           provider:stripe  default:false
// Rest of World→USD $  locales:[]                                                provider:stripe  default:true

model DiscountCode {
  id         String    @id @default(cuid())
  code       String    @unique
  type       String    // "FIXED" | "PERCENT"
  value      Int       // credits if FIXED, percentage 0-100 if PERCENT
  usageLimit Int?      // null = unlimited
  usedCount  Int       @default(0)
  expiresAt  DateTime?
  active     Boolean   @default(true)
  createdAt  DateTime  @default(now())
}

model Page {
  id        String   @id @default(cuid())
  slug      String   @unique  // "terms" | "privacy" | "why-bitcoin" — custom pages get a user-defined slug
  isSystem  Boolean  @default(false)  // system pages (terms, privacy, why-bitcoin) cannot be deleted
  titleNl   String
  titleEn   String
  contentNl String   @db.Text  // Markdown
  contentEn String   @db.Text  // Markdown
  published Boolean  @default(true)
  order     Int      @default(0)   // controls display order in admin list
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Seed pages (isSystem: true):
// { slug: "terms",       titleNl: "Algemene Voorwaarden", titleEn: "Terms of Service",    contentNl: "…", contentEn: "…", published: true }
// { slug: "privacy",     titleNl: "Privacybeleid",        titleEn: "Privacy Policy",       contentNl: "…", contentEn: "…", published: true }
// { slug: "why-bitcoin", titleNl: "Waarom Bitcoin?",      titleEn: "Why Bitcoin?",         contentNl: "…", contentEn: "…", published: true }

model AdminSettings {
  key   String @id
  value Json
  // Seed rows:
  // { key: "monthly_free_credits",    value: 75    }
  // { key: "cost_game_template",      value: 25    }  // updated from 10 — group features
  // { key: "cost_league",             value: 10    }  // new — create a league
  // { key: "cost_add_player",         value: 10    }  // new — send a connection request
  // { key: "cost_played_game",        value: 5     }  // was cost_session
  // { key: "low_credit_threshold",    value: 20    }
  // { key: "strike_enabled",          value: false    }  // enable Bitcoin Lightning payments
  // { key: "bitcoin_discount_percent",value: 10       }  // % discount auto-applied for Bitcoin
  // { key: "oss_threshold_cents",     value: 1000000  }  // €10,000 OSS threshold in EUR cents
  //
  // Landing page CMS keys (all values are JSON objects):
  // { key: "landing_hero",     value: { headline, subheadline, ctaPrimary, ctaSecondary, badge } }
  // { key: "landing_features", value: [{ icon, title, description }, …] }
  // { key: "landing_pricing",  value: {
  //     monthlyFree: 75,
  //     creditAmounts: [100, 300, 800, 2000],  // pack sizes shown on landing page
  //     actionCosts: { gameTemplate: 25, league: 10, addPlayer: 10, playedGame: 5 }
  //   }
  // }
  // Actual prices per pack are stored in PricingRegion.packs — landing page loads
  // the correct region's prices at render time based on Accept-Language.
  // { key: "landing_cta",      value: { headline, body, buttonLabel } }
  // { key: "landing_footer",   value: { tagline, links: [{ label, href }] } }
}

model Review {
  id                String   @id @default(cuid())
  name              String
  review            String
  favoriteBoardGame String
  visible           Boolean  @default(true)
  order             Int      @default(0)   // controls display order on landing page
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

---

## 6. Middleware

`src/middleware.ts` handles two concerns in sequence:

1. **Locale detection** (next-intl) — applies to `[locale]` routes only. Reads `Accept-Language` header; if it starts with `nl`, routes to `/nl/`; otherwise `/en/`. Skips `/app/**`, `/admin/**`, `/share/**`, `/api/**`.

2. **Auth guard** — applies to `/app/**` and `/admin/**`. Checks NextAuth v5 session. Unauthenticated → redirect to `/[locale]/auth/login`. Admin routes additionally require `user.role === 'admin'`.

---

## 7. Credit deduction flow

All credit-costing actions go through `lib/credits.ts → deductCredits(userId, action)`:

```
1. Fetch user { credits, isLifetimeFree }
2. If isLifetimeFree → return { ok: true, newBalance: credits } (no deduction)
3. Read action cost from AdminSettings (fallback to hardcoded defaults)
4. If credits < cost → throw InsufficientCreditsError
5. Prisma transaction:
   a. UPDATE User SET credits = credits - cost WHERE id = userId
   b. INSERT CreditTransaction { delta: -cost, reason: action, meta }
6. Return { ok: true, newBalance: credits - cost }
```

Prisma transaction is the source of truth for balances. Redis is used only for rate limiting (prevent double-submit within 3 seconds per user per action).

---

## 8. Auth flow

**Registration**: email + password → bcrypt hash → 24hr email verification token stored in Redis → Mailgun sends verify link → user clicks → `emailVerified` set → session issued.

**Login**: verify password → if `totpEnabled`, redirect to `/auth/totp-challenge` → verify TOTP code or backup code → session issued. If `requiresMfa && !totpEnabled`, block login and redirect to MFA setup.

**TOTP setup** (optional, from Settings): generate secret → display QR code → user confirms 6-digit code → save `totpSecret` + `totpEnabled = true` → generate 8 backup codes → show once, store hashed.

**Forgot password**: submit email → 15min reset token stored in Redis → Mailgun sends reset link → user sets new password → token deleted.

---

## 9. Redis key map

| Purpose | Key pattern | TTL |
|---|---|---|
| Email verification token | `email_verify:{token}` | 24 hr |
| Password reset token | `pw_reset:{token}` | 15 min |
| Rate limit — session submit | `rl:session:{userId}` | 3 sec |
| Rate limit — login attempts | `rl:login:{email}` | 15 min |
| Dashboard cache | `cache:dashboard:{userId}` | 5 min |
| Monthly cron lock | `cron:credit_reset:{YYYY-MM}` | 25 hr |

---

## 10. i18n

- **Library**: next-intl
- **Languages**: Dutch (`nl`), English (`en`)
- **Detection**: `Accept-Language` header → `nl` → Dutch, else English
- **Routing**: `/[locale]/` prefix on marketing + auth pages only
- **App routes**: locale read from `user.locale` (DB), passed to `getTranslations()` server-side
- **Admin**: Dutch-only, no locale routing, no i18n library needed
- **Emails**: translated via `messages/{locale}/emails.json` + `getTranslations()` before Mailgun send
- **Adding a language**: add `messages/{code}/` folder with all namespaces, add code to next-intl config — zero code changes elsewhere
- **Rule**: no hardcoded user-facing strings anywhere in components

---

## 11. Payments

### Region detection & pricing

- At checkout (and on the landing pricing section), the user's `PricingRegion` is resolved by matching `Accept-Language` against `PricingRegion.locales` — first match wins, fallback to `isDefault: true` region
- The matched region provides: currency, symbol, provider, and pack prices in cents
- The user can override their detected region at checkout via a dropdown — this is important for travellers and VPN users
- Prices are shown as `{symbol}{amount}` e.g. `€4.99`, `$4.99`, `R$24.99`

### Payment providers

- **Mollie** — used for regions with `provider: "mollie"` (EU) — supports iDEAL, Bancontact, credit card — charges in `PricingRegion.currency`
- **Stripe** — used for all other regions — supports cards worldwide — charges in `PricingRegion.currency`
- Both redirect back to `/app/credits/success?provider={mollie|stripe}` on completion

### Checkout flow

```
1. User selects a credit pack
2. Detected PricingRegion loaded — price shown in region's currency
3. User optionally applies discount code → adjusted price shown
4. User can change region → prices update immediately
5. CreditPurchase record created (status: "pending") with regionId, currency, amountCents
6. Checkout session created with correct provider + currency
7. User completes payment on provider page
8. Webhook received → verify → set status "paid" → addCredits() → send receipt
```

### Webhook delivery

Both providers POST to `/api/webhooks/{mollie|stripe}` → verify signature → find `CreditPurchase` by `externalId` → if `status === 'pending'`, set `status = 'paid'`, call `addCredits(userId, credits)`, send receipt email — fully idempotent.

### Bitcoin Lightning via Strike *(Phase 7 — future)*

- **Provider**: Strike API (`@strike-labs/strike-api` or REST) — Lightning Network payments
- **Discount**: Bitcoin users always receive **10% off** automatically — no code needed, applied before checkout. Discount rate stored in `AdminSettings` key `bitcoin_discount_percent` (default: 10), configurable in admin.
- **Currency**: Strike settles in USD. Lightning payments are region-agnostic — skip `PricingRegion.provider` logic for Strike, always charge in USD at the region's USD-equivalent price (or the region's local price converted, TBD at implementation time).
- **`CreditPurchase.provider`**: `"strike"` — already supported by the string field.
- **Webhook**: Strike posts to `/api/webhooks/strike` → same idempotent pattern as Mollie/Stripe.
- **UI**: Show Lightning bolt icon + "Pay with Bitcoin ⚡ — 10% off" option at checkout alongside Mollie/Stripe. Only shown when Strike is enabled in admin settings (`strike_enabled: true` in `AdminSettings`).
- **Receipt email**: notes payment via Bitcoin Lightning and shows the discount applied.

### Discount codes

Applied at checkout before payment. Adjusted amount stored in `CreditPurchase.meta` alongside original amount and code used. Discount is applied to the region price (e.g. 20% off €12.99 = €10.39).

### Admin: pricing regions

Full CRUD at `/admin/settings/pricing-regions`:
- Create / edit / delete regions
- Set name, currency, symbol, locale prefixes, provider, active toggle, display order
- Set pack prices per credit amount (100 / 300 / 800 / 2000 credits) in cents for that region's currency
- Exactly one region must be marked `isDefault`
- Changes take effect immediately — no redeploy needed

---

## 12. Emails (Mailgun)

| Trigger | Template key | Phase |
|---|---|---|
| Registration | `emails.verify_email` | 1b |
| Forgot password | `emails.reset_password` | 1b |
| MFA setup confirmed | `emails.mfa_enabled` | 1b |
| Credit purchase receipt | `emails.purchase_receipt` | 5 |
| Low-credit warning | `emails.low_credit_warning` | 4 |
| Monthly credit reset | `emails.monthly_reset` | 6 |

---

## 13. Deployment

- **Platform**: Coolify on VPS, GitHub webhook for auto-deploy
- **Dockerfile**: multi-stage — `deps` (install) → `builder` (next build) → `runner` (node:alpine, non-root)
- **Coolify services**: Next.js app + PostgreSQL (separate resource) + Redis (separate resource)
- **Post-deploy hook**: `npx prisma migrate deploy`
- **Health check**: `GET /api/health` → `{ db: "ok", redis: "ok" }` — used by Coolify health probe
- **Env vars**: all documented in `.env.example`

### README — living deployment guide

`README.md` at the repo root is the single source of truth for deploying Dice Vault on Coolify. It is updated at the **end of every phase** to reflect any new environment variables, services, or deployment steps introduced in that phase.

**Sections README must always contain:**

| Section | Contents |
|---|---|
| Prerequisites | Node version, Docker, Coolify version, VPS requirements |
| Local development | `docker compose up`, env setup, `prisma migrate dev`, `npm run dev` |
| Environment variables | Full table: variable name, required/optional, where to get the value, which phase introduced it |
| Coolify setup | Step-by-step: create PostgreSQL service, Redis service, Next.js app resource, set env vars, post-deploy command, health check path |
| GitHub auto-deploy | Webhook setup instructions |
| Running migrations | `npx prisma migrate deploy` — when and how |
| Phase changelog | One-line entry per phase: what was added that affects deployment |

**Rule**: if a phase introduces a new env var, new service, or changes any deployment step, the README is updated as part of that phase's work — never left for later.

---

## 14. Tax export (Dutch BTW / VAT compliance)

Tax export is available in the admin panel at `/admin/billing/tax-export`. It generates a Dutch OB (Omzetbelasting) report for a selected period — designed to be copy-pasted into the Belastingdienst portal by a Dutch ZZP or small business owner.

### VAT treatment rules

Every paid `CreditPurchase` is assigned a `vatTreatment` automatically at payment confirmation, based on `customerCountry` and `customerVatNumber`:

| Treatment | Condition | OB Box | VAT rate |
|---|---|---|---|
| `NL_21` | `customerCountry === "NL"` | 1a | 21% |
| `EU_REVERSE_CHARGE` | EU country + valid `customerVatNumber` | 3b | 0% |
| `EU_OSS` | EU country + no VAT number (B2C) | OSS / 1a | Local rate (21% default) |
| `EXPORT` | Non-EU country | 3a | 0% |

> **Note**: OSS (One Stop Shop) applies when B2C EU sales exceed the €10,000 annual threshold. Below that threshold, Dutch 21% applies. This threshold is configurable in `AdminSettings` key `oss_threshold_cents`.

### Currency conversion at payment time

When a `CreditPurchase` status moves to `"paid"`, the webhook handler immediately fetches and stores the conversion rate:

- **EUR**: `eurAmountCents = amountCents`, `exchangeRate = null`, `exchangeRateSource = "fixed_1"`
- **USD**: fetch ECB reference rate for payment date → store rate + `"ECB"` source
- **Bitcoin (Strike, Phase 7)**: fetch Coinbase closing rate for payment date → store rate + `"Coinbase"` source

Rates are stored on `CreditPurchase` permanently — they are never recalculated. This satisfies the Belastingdienst requirement to document the rate used.

**ECB rate API**: `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A` — free, no key required.
**Coinbase rate API**: `https://api.coinbase.com/v2/prices/BTC-EUR/spot?date={YYYY-MM-DD}` — free.

### Invoice numbers

Sequential invoice numbers are assigned at payment confirmation: `DV-{YYYY}-{NNNN}` (e.g. `DV-2026-0001`). The sequence resets each calendar year. Stored on `CreditPurchase.invoiceNumber`.

### Report output

**1. Summary table** (OB boxes):

| OB Box | Description | Turnover excl. VAT (€) | Output VAT (€) |
|---|---|---|---|
| 1a | Domestic NL sales 21% | € X | € Y |
| 3b | Intra-EU reverse charge | € X | € 0 |
| 3a | Export outside EU | € X | € 0 |

**2. Detailed transaction list** — CSV-downloadable, columns:
- Invoice number
- Invoice date
- Customer country
- Original currency + amount
- Exchange rate (source + date)
- EUR amount excl. VAT
- VAT rate
- VAT amount (€)
- VAT treatment / OB box
- Payment method (Mollie / Stripe / Bitcoin Lightning)

**3. Totals**: Total turnover excl. VAT + Total output VAT

**4. Disclaimer** (as per the prompt, shown on report and in CSV footer):
> *"This report converts all payments (including Bitcoin) to euros as required by the Belastingdienst. Always verify exchange rates and keep proof of the rates used. For crypto, document the market value at the time of invoicing or payment. This is not official tax advice."*

### Admin UI

- Period selector: quarter (Q1–Q4) or custom date range
- Download as CSV button
- Preview table in-browser before download
- Tooltip on each row showing exchange rate source + date
- Implemented in Phase 6 (needs Phase 5 payment data to be meaningful)

---

## 15. Admin — Landing page CMS

All landing page text content is managed from the admin panel under `/admin/landing`. The landing page reads its content from the database at request time (with Redis caching, 10-min TTL) — no redeploy needed to update copy.

### Sections managed in admin

| Section | Admin UI | Stored as |
|---|---|---|
| Hero | Headline, subheadline, primary CTA label, secondary CTA label, badge text | `AdminSettings` key `landing_hero` (JSON) |
| Features | 3 cards: icon name (Lucide), title, description — describe core product features, not plan limits | `AdminSettings` key `landing_features` (JSON array) |
| Pricing | Credit-based: monthly free credits + 4 one-time credit packs with prices | `AdminSettings` key `landing_pricing` (JSON) |
| CTA banner | Headline, body text, button label | `AdminSettings` key `landing_cta` (JSON) |
| Footer | Tagline, link labels (incl. auto-links to published Pages) | `AdminSettings` key `landing_footer` (JSON) |
| Reviews | Full CRUD — see below | `Review` model |

The landing page **structure** (layout, colours, components) is hardcoded in Next.js. Only the **text content** is CMS-managed. Adding new sections requires a code change.

> **Note**: `reference/landing.html` shows a subscription tier pricing section (Vault Keeper / Grandmaster). This is **outdated** — the built landing page must show the credit-based pricing model instead: monthly free credits + four one-time credit packs. The visual layout of the pricing section can be adapted (e.g. one "free" info block + a grid of 4 pack cards), but must match the design guidelines.

Both Dutch and English copy are stored per key:
```json
{
  "nl": { "headline": "Bewaar je scores veilig." },
  "en": { "headline": "Store your scores safely." }
}
```
Each `AdminSettings` landing key holds both locale variants. The landing page reads the correct locale at render time.

### Reviews management

Full CRUD in admin at `/admin/landing/reviews`. Each review has:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Reviewer's display name |
| `review` | string | Review text (max 280 chars recommended) |
| `favoriteBoardGame` | string | Shown as subtitle under name |
| `visible` | boolean | Toggle to show/hide on landing page without deleting |
| `order` | integer | Drag-to-reorder in admin, controls display sequence |

The landing page shows only `visible: true` reviews, sorted by `order` ascending.

---

## 16. Pages CMS & cookie consent

### Pages CMS

The `Page` model provides a lightweight CMS for content pages that sit outside the app but belong to the site — legal documents, explanatory content, and anything else the owner needs to publish without a code deployment.

**Admin interface** at `/admin/pages`:
- List of all pages (title, slug, published toggle, last-updated date)
- Create new page: set slug, Dutch title, English title, Dutch content (Markdown), English content (Markdown), published toggle
- Edit any page — same fields
- Delete non-system pages (system pages show a lock icon and cannot be deleted)
- System pages (Terms, Privacy, Why Bitcoin) are pre-seeded and always present

**Public rendering** at `/[locale]/p/[slug]`:
- Server-rendered, reads `Page` record by slug
- Renders the correct locale variant (`titleNl`/`titleEn`, `contentNl`/`contentEn`) based on `[locale]`
- Markdown rendered to HTML via `react-markdown` + `remark-gfm`
- If `published: false` → 404
- Shares the same marketing layout (header/footer) as the landing page

**Footer links**: The landing page footer automatically includes links to all published pages in `display order` (ascending `order` field). System pages always appear first (Terms → Privacy → Why Bitcoin), then any custom pages the admin has added.

### Pre-seeded system pages

| Slug | Dutch title | English title | Purpose |
|---|---|---|---|
| `terms` | Algemene Voorwaarden | Terms of Service | Legal — required for SaaS |
| `privacy` | Privacybeleid | Privacy Policy | GDPR — includes cookie policy section |
| `why-bitcoin` | Waarom Bitcoin? | Why Bitcoin? | Explains the Bitcoin Lightning payment option |

Seed content is minimal placeholder text. The admin edits it to the real copy before launch.

The `privacy` page covers the cookie policy — a dedicated separate "Cookie Policy" slug is not needed because Dice Vault uses only essential cookies (session). The cookie consent banner (see below) links to the Privacy page.

### Cookie consent banner

A minimal GDPR-compliant cookie banner shown on first visit to any `[locale]` marketing page. It disappears once the user clicks "Accept" or "I understand."

**Behaviour:**
- Shown only on marketing pages (`/[locale]/**`) — not inside `/app/` (user is already authenticated and has accepted)
- Preference stored in `localStorage` key `cookie_consent = "accepted"` — no server round-trip
- Banner does **not** block page interaction (soft bar at bottom, not a modal overlay)
- Links to `/[locale]/p/privacy` for "read our Privacy Policy"
- No cookie categories — Dice Vault uses only essential cookies (NextAuth session)

**i18n**: banner copy in `messages/{locale}/common.json` under `cookieBanner.*` keys.

**Component**: `src/components/layout/CookieBanner.tsx` — mounted in the `[locale]/layout.tsx` (marketing layout only).

---

## 17. Phase breakdown

> **Standing rule — README:** Every phase must update `README.md` at the end of its work. If the phase adds env vars, new services, or changes any deployment step, the README env-var table, Coolify setup section, and phase changelog must reflect it before the phase is considered complete.

> **Standing rule — GitHub push:** Commits are made throughout a phase (one per task), but `git push` happens **once — at the very end of the phase**, after all tasks are complete and all tests pass. Never push mid-phase.

| Phase | Scope |
|---|---|
| **1a** | Scaffold Next.js + Tailwind v3 + shadcn/ui + Prisma (minimal schema) + Dockerfile + docker-compose + `.env.example` + health endpoint + deploy to Coolify + verify DB/Redis live + **create initial `README.md`** (all sections — local dev, env vars, Coolify setup, GitHub webhook) |
| **1b** | next-intl (nl/en, locale detection middleware) + landing page + auth pages (register, login, forgot/reset password, verify email) + NextAuth v5 Credentials + TOTP optional MFA + app shell layout (sidebar, bottom nav) + email verification via Mailgun + **README: add Mailgun env vars** |
| **2** | Players CRUD + Game Template wizard (3-step, **25 credits**) + **League** creation (10 credits) + **PlayedGame** logging (5 credits, owner only) + credit deduction + CreditTransaction log + credit balance in sidebar + Redis rate limiting + low-credit banner + **README: no new env vars** |
| **3** | **Connection flow** (invite by username/email/QR + accept/decline) + **VaultConnection** social graph + **shared vault UI** (corner ribbon) + **notification bell** (in-app) + Dashboard + player stats + Redis dashboard caching + shareable read-only played-game link (`/share/[token]`) + **PlayedGame approval flow** (connected player submits → owner accepts/rejects) + **README: no new env vars** |
| **4** | Admin panel (Dutch only) + user management + manual credit adjustment + lifetime free toggle + discount codes + admin configurable settings + pricing regions CRUD + landing page CMS + reviews CRUD + **Pages CMS** + **cookie consent banner** + **email notifications** (connection requests, league invites, played game approval/rejection) + **admin: pending played game approvals view** + **README: no new env vars** |
| **5** | Mollie + Stripe one-time credit purchase + webhooks + idempotent credit delivery + receipt email + discount code redemption at checkout + **README: add Mollie + Stripe + webhook env vars** |
| **6** | Monthly credit reset cron (Redis lock) + low-credit warning emails + `requiresMfa` enforcement + tax export (`/admin/billing/tax-export`) + ECB/Coinbase rate fetching at payment time + sequential invoice numbers + VAT treatment auto-assignment + CSV download + responsive QA + final polish + **README: final review of all sections** |
| **7** *(future)* | Bitcoin Lightning payments via Strike + automatic 10% discount + `/api/webhooks/strike` + admin toggle (`strike_enabled`) + configurable discount rate + Lightning bolt UI at checkout + **README: add Strike env vars** |

---

## 18. Error handling convention

- Server actions return `{ success: boolean, error?: string }` — never throw to client
- `error` is always a `next-intl` key (e.g. `"errors.insufficient_credits"`) — client resolves to translated string
- Unhandled errors caught by Next.js `error.tsx` per route segment
- Webhook handlers always return HTTP 200 to providers (even on business logic errors) to prevent retry storms — failures logged internally

---

## 19. Toast notifications

All user feedback in the app goes through a single toast system — no inline error paragraphs, no alert dialogs for routine feedback.

**Library**: shadcn/ui `Sonner` toast (ships with shadcn, wraps the `sonner` package) — matches the existing `Toast.tsx` pattern from `reference/index.html`.

**When to toast**:

| Event | Type | Example message key |
|---|---|---|
| Action succeeded | success | `"toasts.session_saved"` |
| Insufficient credits | error | `"toasts.insufficient_credits"` |
| Validation error | error | `"toasts.invalid_form"` |
| Credit purchase complete | success | `"toasts.credits_added"` |
| Copied share link | info | `"toasts.link_copied"` |
| Player added/removed | success | `"toasts.player_saved"` |
| Game template created | success | `"toasts.template_created"` |
| Settings saved | success | `"toasts.settings_saved"` |
| Network / server error | error | `"toasts.server_error"` |
| MFA enabled | success | `"toasts.mfa_enabled"` |

**Rules**:
- All toast messages are `next-intl` keys — no hardcoded strings
- Success toasts auto-dismiss after 3 seconds
- Error toasts auto-dismiss after 5 seconds and include a brief description where helpful
- One `<Toaster />` mounted in the app layout (`/app/layout.tsx`) — not in individual pages
- Server action responses trigger toasts client-side: `if (result.error) toast.error(t(result.error))`
- Admin area uses the same Sonner toaster but Dutch strings only

---

## 20. Group & social features

The full group and social features design — Leagues, connections, VaultConnection social graph, notifications, shared vault UI — is documented in a dedicated spec:

**`docs/superpowers/specs/2026-04-17-group-social-features-design.md`**

Key changes from the original spec that are reflected above:
- `Session` renamed to `PlayedGame` throughout (section 5)
- `cost_game_template` updated from 10 → 25 (section 5, AdminSettings)
- New credit actions: `cost_league: 10`, `cost_add_player: 10`, `cost_played_game: 5` (section 5)
- Phase 2, 3, 4 descriptions updated to include group feature work (section 17)

---

## 21. Credits, free mode & analytics

The full credit pool split, free mode toggle, scheduled free periods, credit wallet UI, and analytics design is documented in:

**`docs/superpowers/specs/2026-04-17-credits-free-mode-design.md`**

Key changes that affect this spec:
- `credits Int` on `User` replaced by `monthlyCredits Int` + `permanentCredits Int` (section 5)
- `CreditTransaction` gains a `pool String` column (section 5)
- New `FreePeriod` model added (section 5)
- New `AdminSettings` keys: `free_mode_active`, `free_mode_banner_nl`, `free_mode_banner_en` (section 5)
