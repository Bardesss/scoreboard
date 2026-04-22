# Integrations — Design Spec

**Date:** 2026-04-22
**Status:** Approved for implementation planning

---

## Goal

Move all external service credentials out of ENV vars and into the admin UI. Admins configure integrations through `/admin/settings/integrations`. Credentials are stored encrypted in the database. No new ENV vars are introduced.

**In scope (this phase):**
- `Integration` Prisma model + AES-256-GCM encryption layer
- Mailgun fully migrated from ENV → DB
- `/admin/settings/integrations` page with Mailgun card + stub cards for future providers
- Mailgun "Test connection" fetches domain stats from Mailgun API and persists status

**Deferred to Phase 7 (payments):**
- Mollie, Stripe, Strike — config shapes and wiring are specified in `2026-04-16-dice-vault-design.md` §11 (Payments)
- ECB + VIES — no API key needed, covered in the same payments spec

---

## Data Model

### New: `Integration` model

```prisma
model Integration {
  id              String    @id @default(cuid())
  provider        String    @unique  // "mailgun" | "mollie" | "stripe" | "strike"
  encryptedConfig String    // AES-256-GCM encrypted JSON
  status          String    @default("unconfigured") // "unconfigured" | "ok" | "error"
  lastTestedAt    DateTime?
  lastError       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

One row per provider, created on first save.

### Mailgun config shape (stored encrypted)

```ts
type MailgunConfig = {
  apiKey: string    // Mailgun private API key
  domain: string    // Sending domain, e.g. mg.dicevault.fun
  from: string      // From address, e.g. "Dice Vault <noreply@dicevault.fun>"
  region: 'eu' | 'us'
}
```

Payment provider config shapes (Mollie, Stripe, Strike) are defined in `2026-04-16-dice-vault-design.md` §11.

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
`NEXTAUTH_SECRET` rotation invalidates all stored configs — admin must re-enter credentials after rotation. Document in README.

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
- On load: if a row exists, fields show `••••••••` — user must re-enter to change (config never sent to client)
- **Save** button: calls `saveMailgunConfig` Server Action → encrypts → upserts DB → invalidates Redis cache
- **Test connection** button: calls `testMailgunConnection` Server Action → hits `GET /v4/domains/{domain}` on Mailgun API → stores result in `Integration.status` + `lastError` → returns result to client
- Status badge on card header: grey "Niet geconfigureerd" / green "Verbonden" / red "Fout"
- When status is `ok`: shows domain name, region, and sending stats (see below)

### Stub cards (Phase 7)

Cards for Mollie, Stripe, Strike rendered with provider name, "Beschikbaar in Fase 7" badge, lock icon, no form fields. Same card chrome as Mailgun for visual consistency.

### Shortcut on `/admin/settings`

A card added below the existing free-mode card linking to `/admin/settings/integrations`, showing the count of configured integrations (e.g. "1 van 4 geconfigureerd").

---

## Mailgun Stats (from API)

Fetched during "Test connection" only — never on page load. Cached in Redis under `integration:mailgun:stats` with a **1-hour TTL**. If the cache has expired, the stats section shows "Klik Test om statistieken te vernieuwen."

- Domain status (active / disabled / unverified)
- Monthly message quota + used (if on paid plan — absent on free plans, handle gracefully)
- Last 30 days: total sent, delivered, failed (from Mailgun `/v3/{domain}/stats/total`)

Stats are not sensitive — stored unencrypted in Redis.

---

## Security Notes

- Encrypted config is never sent to the browser
- Re-entering credentials requires typing the full value (no partial reveal)
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
