# Integrations — Design Spec

**Date:** 2026-04-22
**Status:** Approved for implementation planning

---

## Goal

Move all external service credentials out of ENV vars and into the admin UI. Admins configure integrations through `/admin/settings/integrations`. Credentials are stored encrypted in the database. No new ENV vars are introduced.

**In scope for Phase 7A (this spec):**
- `Integration` Prisma model + AES-256-GCM encryption layer
- Mailgun fully migrated from ENV → DB
- `/admin/settings/integrations` page with Mailgun card + stub cards for future providers
- Mailgun "Test connection" fetches domain stats from Mailgun API and persists status

**Deferred to Phase 7B (payments):**
- Mollie, Stripe, Strike configuration and webhooks
- ECB exchange rate fetching (auto, no key)
- VIES VAT number validation (auto, no key)
- CSV/PDF tax export with real data

---

## Data Model

### New: `Integration` model

```prisma
model Integration {
  id              String    @id @default(cuid())
  provider        String    @unique  // "mailgun" | "mollie" | "stripe" | "strike"
  encryptedConfig String    // AES-256-GCM encrypted JSON, see config shapes below
  status          String    @default("unconfigured") // "unconfigured" | "ok" | "error"
  lastTestedAt    DateTime?
  lastError       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

One row per provider, created on first save.

### Config shapes (stored encrypted)

```ts
// provider: "mailgun"
type MailgunConfig = {
  apiKey: string    // Mailgun private API key
  domain: string    // Sending domain, e.g. mg.dicevault.fun
  from: string      // From address, e.g. "Dice Vault <noreply@dicevault.fun>"
  region: 'eu' | 'us'
}

// provider: "mollie" (Phase 7B)
type MollieConfig = {
  apiKey: string    // Live key (lk_...)
  webhookSecret: string
}

// provider: "stripe" (Phase 7B)
type StripeConfig = {
  secretKey: string
  webhookSecret: string
}

// provider: "strike" (Phase 7B)
type StrikeConfig = {
  apiKey: string
}
```

---

## Encryption Layer

**File:** `src/lib/encryption.ts`

- Algorithm: AES-256-GCM
- Key: SHA-256 hash of `process.env.NEXTAUTH_SECRET`
- Each encrypt call generates a fresh random IV (12 bytes)
- Stored format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>` — a single string column
- `encrypt(plaintext: string): string`
- `decrypt(ciphertext: string): string`
- Both are pure synchronous functions using Node.js `crypto`

No new ENV vars. `NEXTAUTH_SECRET` is already required.

---

## Integration Config Access

**File:** `src/lib/integrations.ts`

```ts
getIntegrationConfig(provider: string): Promise<Record<string, string> | null>
saveIntegrationConfig(provider: string, config: Record<string, string>): Promise<void>
setIntegrationStatus(provider: string, status: 'ok' | 'error', error?: string): Promise<void>
```

- `getIntegrationConfig` reads from DB, decrypts, returns parsed JSON or `null` if unconfigured
- Result is cached in Redis under `integration:<provider>` with a **5-minute TTL**
- Cache is invalidated on every `saveIntegrationConfig` call
- `saveIntegrationConfig` encrypts and upserts the Integration row, resets status to `'unconfigured'` until tested

---

## `mail.ts` Migration

**Current:** reads `process.env.MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM`

**After:** calls `getIntegrationConfig('mailgun')` and uses the decrypted config.

```ts
// Before
export function isMailConfigured(): boolean {
  return !!(process.env.MAILGUN_API_KEY && ...)
}

// After
export async function isMailConfigured(): Promise<boolean> {
  const config = await getIntegrationConfig('mailgun')
  return !!(config?.apiKey && config?.domain && config?.from)
}
```

All callers of `isMailConfigured()` and `sendEmail()` are already in server-side code (Server Actions, API routes) so the async change is safe.

ENV vars `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` are **removed** from `.env.example` and README. Migration note added to README: configure Mailgun via `/admin/settings/integrations` after deploy.

---

## Admin UI

### Route: `/admin/settings/integrations`

Pattern: identical to `/admin/settings/discount-codes` — server page + client component.

**Server page** (`page.tsx`): fetches all `Integration` rows (only `provider`, `status`, `lastTestedAt`, `lastError` — never passes decrypted config to client). Passes sanitized data to `IntegrationsClient`.

**Client component** (`IntegrationsClient.tsx`): renders one card per provider.

### Mailgun card

- Fields: API key (password input), Domain, From address, Region (EU / US toggle)
- On load: if status is `ok` or `error`, fields show placeholder `••••••••` — user must re-enter to change (config never sent to client)
- **Save** button: calls `saveMailgunConfig` Server Action → encrypts → upserts DB → invalidates Redis cache
- **Test connection** button: calls `testMailgunConnection` Server Action → hits `GET /v4/domains/{domain}` on Mailgun API → stores result in `Integration.status` + `lastError` → returns result to client
- Status badge on card header: grey "Niet geconfigureerd" / green "Verbonden" / red "Fout"
- When status is `ok`: shows domain name, region, and monthly send quota (from Mailgun domain stats)

### Stub cards (Phase 7B)

Cards for Mollie, Stripe, Strike rendered with:
- Provider logo/name
- Badge: "Beschikbaar in Fase 7"
- Lock icon, no form fields
- Same card chrome as Mailgun for visual consistency

### Shortcut on `/admin/settings`

A card added below the existing free-mode card on the main settings page:

> **Integraties** → Link to `/admin/settings/integrations`
> Shows count of configured integrations, e.g. "1 van 4 geconfigureerd"

---

## Mailgun Stats (from API)

Fetched during "Test connection" only — never on page load. Cached in Redis under `integration:mailgun:stats` with a **1-hour TTL**. If the cache has expired, the stats section shows "Klik Test om statistieken te vernieuwen."

- Domain status (active / disabled / unverified)
- Monthly message quota + used (if on paid plan — may be absent on free plans, handle gracefully)
- Last 30 days: total sent, delivered, failed (from Mailgun `/v3/{domain}/stats/total`)

Shown inline on the Mailgun card when cache is warm. Stats are not sensitive so they are stored unencrypted in Redis.

---

## ECB + VIES (Phase 7B reference)

These need no API key and no Integration row.

**ECB:** `https://data-api.ecb.europa.eu/service/data/EXR/D.USD+BTC.EUR.SP00.A` — fetched in the payment webhook handler when recording a `CreditPurchase`. Rate stored on the purchase row (`exchangeRate`, `exchangeRateSource = 'ecb'`, `exchangeRateDate`). No admin config needed.

**VIES:** `https://ec.europa.eu/taxation_customs/vies/services/checkVatService` — called during checkout when a B2B customer enters a VAT number. Result determines `vatTreatment` on the purchase. No admin config needed.

Both will be covered in the Phase 7B payments spec.

---

## Security Notes

- Encrypted config is never sent to the browser — the server page only passes `provider`, `status`, `lastTestedAt`, `lastError`
- Re-entering credentials requires typing the full value again (no partial reveal)
- `NEXTAUTH_SECRET` rotation would invalidate stored configs — admin must re-enter credentials. Document this in README.
- All integration Server Actions are guarded by `session.user.role === 'admin'` check

---

## Files Changed / Created

**New:**
- `prisma/migrations/..._add_integration/migration.sql`
- `src/lib/encryption.ts`
- `src/lib/integrations.ts`
- `src/app/admin/settings/integrations/page.tsx`
- `src/app/admin/settings/integrations/IntegrationsClient.tsx`
- `src/app/admin/settings/integrations/actions.ts`

**Modified:**
- `prisma/schema.prisma` — add `Integration` model
- `src/lib/mail.ts` — read config from DB instead of ENV
- `src/app/admin/settings/SettingsClient.tsx` — add integrations shortcut card
- `.env.example` — remove Mailgun vars, add migration note comment
- `README.md` — update env vars table, add Mailgun setup note

---

## Out of Scope

- SMTP / alternative email providers (Mailgun only for now)
- Admin notification when an integration breaks
- Per-user API key overrides
- Audit log of credential changes
