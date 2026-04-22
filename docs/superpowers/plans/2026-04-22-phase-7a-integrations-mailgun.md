# Phase 7A — Integrations: Mailgun DB Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Mailgun credentials from ENV vars into the database, add an `/admin/settings/integrations` UI for configuring and testing Mailgun, and lay the encrypted `Integration` model that future payment providers will reuse.

**Architecture:** New `Integration` Prisma model holds AES-256-GCM encrypted JSON per provider. A `src/lib/integrations.ts` module handles encrypt/decrypt with Redis caching (5 min TTL). `mail.ts` reads config from DB instead of ENV. The admin UI at `/admin/settings/integrations` follows the exact same server-page + client-component + actions pattern as `/admin/settings/discount-codes`.

**Tech Stack:** Next.js 15 App Router · Prisma 5 · ioredis · Node.js `crypto` (built-in) · Vitest · mailgun.js (already installed)

---

## File Map

**New files:**
- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt, keyed from `NEXTAUTH_SECRET`
- `src/lib/encryption.test.ts` — unit tests for encrypt/decrypt
- `src/lib/integrations.ts` — `getIntegrationConfig`, `saveIntegrationConfig`, `setIntegrationStatus`
- `src/lib/integrations.test.ts` — unit tests for integrations layer
- `src/app/admin/settings/integrations/page.tsx` — server page (fetches non-sensitive Integration rows + cached stats)
- `src/app/admin/settings/integrations/IntegrationsClient.tsx` — client component (Mailgun form + stub cards)
- `src/app/admin/settings/integrations/actions.ts` — `saveMailgunConfig`, `testMailgunConnection`

**Modified files:**
- `prisma/schema.prisma` — add `Integration` model
- `src/lib/mail.ts` — read config from `getIntegrationConfig('mailgun')` instead of ENV
- `src/test/mail.test.ts` — mock `getIntegrationConfig` instead of `process.env`
- `src/app/[locale]/(auth)/auth/actions.ts` — `await isMailConfigured()` (was sync)
- `src/app/admin/settings/SettingsClient.tsx` — add integrations shortcut card
- `.env.example` — remove `MAILGUN_*` vars, add migration note
- `README.md` — update env vars table, add Mailgun setup note
- `docs/superpowers/plans/INDEX.md` — add Phase 7A row

---

## Task 1: Prisma — add `Integration` model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add model to schema**

Open `prisma/schema.prisma` and append after the `CreditPurchase` model:

```prisma
model Integration {
  id              String    @id @default(cuid())
  provider        String    @unique
  encryptedConfig String
  status          String    @default("unconfigured")
  lastTestedAt    DateTime?
  lastError       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

- [ ] **Step 2: Generate and run migration**

```bash
npx prisma migrate dev --name add_integration
```

Expected: migration file created, Prisma client regenerated, no errors.

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test"
```

Expected: no output (only pre-existing test errors suppressed).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Integration model for encrypted provider credentials"
```

---

## Task 2: Encryption layer

**Files:**
- Create: `src/lib/encryption.ts`
- Create: `src/lib/encryption.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/encryption.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long!!'
})

describe('encrypt / decrypt', () => {
  it('round-trips a string', async () => {
    const { encrypt, decrypt } = await import('./encryption')
    const plaintext = 'hello world'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const { encrypt } = await import('./encryption')
    expect(encrypt('same input')).not.toBe(encrypt('same input'))
  })

  it('round-trips a JSON object serialized to string', async () => {
    const { encrypt, decrypt } = await import('./encryption')
    const obj = JSON.stringify({ apiKey: 'key123', domain: 'mg.example.com' })
    expect(decrypt(encrypt(obj))).toBe(obj)
  })

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('./encryption')
    const ciphertext = encrypt('secret')
    const tampered = ciphertext.slice(0, -4) + 'xxxx'
    expect(() => decrypt(tampered)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/encryption.test.ts
```

Expected: FAIL — `encryption` module not found.

- [ ] **Step 3: Implement `encryption.ts`**

Create `src/lib/encryption.ts`:

```typescript
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

function deriveKey(): Buffer {
  return createHash('sha256').update(process.env.NEXTAUTH_SECRET!).digest()
}

export function encrypt(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const key = deriveKey()
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/encryption.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/encryption.ts src/lib/encryption.test.ts
git commit -m "feat(lib): AES-256-GCM encryption layer keyed from NEXTAUTH_SECRET"
```

---

## Task 3: Integration config access layer

**Files:**
- Create: `src/lib/integrations.ts`
- Create: `src/lib/integrations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/integrations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long!!'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    integration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}))

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { encrypt } from '@/lib/encryption'

describe('getIntegrationConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no row exists', async () => {
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(null)
    const { getIntegrationConfig } = await import('./integrations')
    expect(await getIntegrationConfig('mailgun')).toBeNull()
  })

  it('returns decrypted config from DB', async () => {
    const config = { apiKey: 'key123', domain: 'mg.example.com', from: 'Test <t@t.com>', region: 'eu' }
    vi.mocked(prisma.integration.findUnique).mockResolvedValue({
      id: '1', provider: 'mailgun',
      encryptedConfig: encrypt(JSON.stringify(config)),
      status: 'ok', lastTestedAt: null, lastError: null,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { getIntegrationConfig } = await import('./integrations')
    expect(await getIntegrationConfig('mailgun')).toEqual(config)
  })

  it('returns cached value from Redis without hitting DB', async () => {
    const config = { apiKey: 'cached', domain: 'mg.example.com', from: 'T <t@t.com>', region: 'eu' }
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(config))
    const { getIntegrationConfig } = await import('./integrations')
    const result = await getIntegrationConfig('mailgun')
    expect(result).toEqual(config)
    expect(prisma.integration.findUnique).not.toHaveBeenCalled()
  })
})

describe('saveIntegrationConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts encrypted config and clears cache', async () => {
    vi.mocked(prisma.integration.upsert).mockResolvedValue({} as any)
    const { saveIntegrationConfig } = await import('./integrations')
    await saveIntegrationConfig('mailgun', { apiKey: 'k', domain: 'd', from: 'f', region: 'eu' })
    expect(prisma.integration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'mailgun' },
      })
    )
    expect(redis.del).toHaveBeenCalledWith('integration:mailgun')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/integrations.test.ts
```

Expected: FAIL — `integrations` module not found.

- [ ] **Step 3: Implement `integrations.ts`**

Create `src/lib/integrations.ts`:

```typescript
import { prisma } from './prisma'
import { redis } from './redis'
import { encrypt, decrypt } from './encryption'

const CACHE_TTL = 300 // 5 minutes

export async function getIntegrationConfig(provider: string): Promise<Record<string, string> | null> {
  const cacheKey = `integration:${provider}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as Record<string, string>

  const row = await prisma.integration.findUnique({ where: { provider } })
  if (!row) return null

  const config = JSON.parse(decrypt(row.encryptedConfig)) as Record<string, string>
  await redis.set(cacheKey, JSON.stringify(config), 'EX', CACHE_TTL)
  return config
}

export async function saveIntegrationConfig(
  provider: string,
  config: Record<string, string>
): Promise<void> {
  const encryptedConfig = encrypt(JSON.stringify(config))
  await prisma.integration.upsert({
    where: { provider },
    create: { provider, encryptedConfig, status: 'unconfigured' },
    update: { encryptedConfig, status: 'unconfigured', lastError: null },
  })
  await redis.del(`integration:${provider}`)
}

export async function setIntegrationStatus(
  provider: string,
  status: 'ok' | 'error',
  error?: string
): Promise<void> {
  await prisma.integration.update({
    where: { provider },
    data: { status, lastError: error ?? null, lastTestedAt: new Date() },
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/integrations.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations.ts src/lib/integrations.test.ts
git commit -m "feat(lib): integration config access — encrypted DB storage with Redis cache"
```

---

## Task 4: Migrate `mail.ts` from ENV to DB

**Files:**
- Modify: `src/lib/mail.ts`
- Modify: `src/test/mail.test.ts`
- Modify: `src/app/[locale]/(auth)/auth/actions.ts`

- [ ] **Step 1: Update `mail.ts`**

Replace the entire `src/lib/mail.ts` with:

```typescript
import Mailgun from 'mailgun.js'
import FormData from 'form-data'
import { getIntegrationConfig } from './integrations'

export async function isMailConfigured(): Promise<boolean> {
  const config = await getIntegrationConfig('mailgun')
  return !!(config?.apiKey && config?.domain && config?.from)
}

async function send(to: string, subject: string, html: string) {
  const config = await getIntegrationConfig('mailgun')
  if (!config?.apiKey || !config?.domain || !config?.from) return

  const mg = new Mailgun(FormData)
  const client = mg.client({
    username: 'api',
    key: config.apiKey,
    url: config.region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
  })

  await client.messages.create(config.domain, {
    from: config.from,
    to,
    subject,
    html,
  })
}

export async function sendVerificationEmail(to: string, token: string, locale: string) {
  const link = `${process.env.NEXTAUTH_URL}/${locale}/auth/verify-email?token=${token}`
  const subject = locale === 'nl' ? 'Bevestig je e-mailadres — Dice Vault' : 'Verify your email — Dice Vault'
  const html = locale === 'nl'
    ? `<p>Klik op de link om je e-mailadres te bevestigen:</p><p><a href="${link}">${link}</a></p><p>De link is 24 uur geldig.</p>`
    : `<p>Click the link to verify your email address:</p><p><a href="${link}">${link}</a></p><p>The link is valid for 24 hours.</p>`
  await send(to, subject, html)
}

export async function sendEmail(to: string, subject: string, html: string) {
  await send(to, subject, html)
}

export async function sendPasswordResetEmail(to: string, token: string, locale: string) {
  const link = `${process.env.NEXTAUTH_URL}/${locale}/auth/reset-password?token=${token}`
  const subject = locale === 'nl' ? 'Wachtwoord resetten — Dice Vault' : 'Reset your password — Dice Vault'
  const html = locale === 'nl'
    ? `<p>Klik op de link om je wachtwoord te resetten:</p><p><a href="${link}">${link}</a></p><p>De link is 15 minuten geldig.</p>`
    : `<p>Click the link to reset your password:</p><p><a href="${link}">${link}</a></p><p>The link is valid for 15 minutes.</p>`
  await send(to, subject, html)
}

export async function sendTicketRepliedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Nieuw antwoord op je supportticket`, body: `Het Dice Vault supportteam heeft gereageerd op je ticket: "${subject}". Log in om het antwoord te bekijken.` }
    : { emailSubject: `New reply to your support ticket`, body: `The Dice Vault support team replied to your ticket: "${subject}". Log in to view the reply.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}

export async function sendTicketClosedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je supportticket is gesloten`, body: `Je ticket "${subject}" is gesloten door ons supportteam.` }
    : { emailSubject: `Your support ticket has been closed`, body: `Your ticket "${subject}" has been closed by our support team.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}

export async function sendTicketAutoClosedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je supportticket is automatisch gesloten`, body: `Je ticket "${subject}" is automatisch gesloten na 7 dagen zonder reactie. Als je nog hulp nodig hebt, open dan een nieuw ticket.` }
    : { emailSubject: `Your support ticket was automatically closed`, body: `Your ticket "${subject}" was automatically closed after 7 days without a reply. If you still need help, please open a new ticket.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}

export async function sendMonthlyResetEmail(to: string, credits: number, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je maandelijkse credits zijn gereset`, body: `Je Dice Vault maandelijkse credits zijn gereset naar ${credits}. Geniet van nog een maand gamen!` }
    : { emailSubject: `Your monthly credits have been reset`, body: `Your Dice Vault monthly credits have been reset to ${credits}. Enjoy another month of gaming!` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}

export async function sendLowCreditWarningEmail(to: string, balance: number, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je Dice Vault credits raken op`, body: `Je hebt nog ${balance} credits. Koop meer om zonder onderbreking games te blijven bijhouden.` }
    : { emailSubject: `Your Dice Vault credits are running low`, body: `You have ${balance} credits remaining. Top up to keep logging games without interruption.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}
```

- [ ] **Step 2: Update `mail.test.ts` to mock `getIntegrationConfig` instead of ENV**

Replace the entire `src/test/mail.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/integrations', () => ({
  getIntegrationConfig: vi.fn().mockResolvedValue({
    apiKey: 'test-key',
    domain: 'test.mailgun.org',
    from: 'Dice Vault <noreply@dicevault.fun>',
    region: 'eu',
  }),
}))

vi.mock('mailgun.js', () => {
  const MockMailgun = vi.fn().mockImplementation(function () {
    return {
      client: vi.fn(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({ id: 'test-id', status: 200 }),
        },
      })),
    }
  })
  return { default: MockMailgun }
})

vi.mock('form-data', () => ({ default: vi.fn() }))

beforeEach(() => {
  process.env.NEXTAUTH_URL = 'https://dicevault.fun'
})

describe('mail', () => {
  it('sendVerificationEmail resolves without throwing', async () => {
    const { sendVerificationEmail } = await import('@/lib/mail')
    await expect(sendVerificationEmail('user@example.com', 'abc123', 'nl')).resolves.not.toThrow()
  })

  it('sendPasswordResetEmail resolves without throwing', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/mail')
    await expect(sendPasswordResetEmail('user@example.com', 'xyz789', 'en')).resolves.not.toThrow()
  })

  it('isMailConfigured returns true when config exists', async () => {
    const { isMailConfigured } = await import('@/lib/mail')
    expect(await isMailConfigured()).toBe(true)
  })

  it('isMailConfigured returns false when config is null', async () => {
    const { getIntegrationConfig } = await import('@/lib/integrations')
    vi.mocked(getIntegrationConfig).mockResolvedValueOnce(null)
    const { isMailConfigured } = await import('@/lib/mail')
    expect(await isMailConfigured()).toBe(false)
  })
})
```

- [ ] **Step 3: Update `auth/actions.ts` — make `isMailConfigured` calls async**

In `src/app/[locale]/(auth)/auth/actions.ts`, change the two synchronous calls to `isMailConfigured()`:

```typescript
// Line ~38: change
emailVerified: isMailConfigured() ? null : new Date(),
// to:
emailVerified: await isMailConfigured() ? null : new Date(),

// Line ~51: change
if (isMailConfigured()) {
// to:
if (await isMailConfigured()) {
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run src/test/mail.test.ts src/lib/integrations.test.ts src/lib/encryption.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mail.ts src/test/mail.test.ts src/app/\[locale\]/\(auth\)/auth/actions.ts
git commit -m "feat(mail): read Mailgun config from DB integration layer instead of ENV"
```

---

## Task 5: Admin Server Actions for integrations

**Files:**
- Create: `src/app/admin/settings/integrations/actions.ts`

- [ ] **Step 1: Create the actions file**

Create `src/app/admin/settings/integrations/actions.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { getIntegrationConfig, saveIntegrationConfig, setIntegrationStatus } from '@/lib/integrations'
import { redis } from '@/lib/redis'
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

async function assertAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorized')
}

export async function saveMailgunConfig(data: {
  apiKey: string
  domain: string
  from: string
  region: 'eu' | 'us'
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin()
    if (!data.apiKey || !data.domain || !data.from) {
      return { success: false, error: 'Alle velden zijn verplicht' }
    }
    await saveIntegrationConfig('mailgun', data)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export type MailgunStats = {
  domainState: string
  sent: number
  delivered: number
  failed: number
}

export async function testMailgunConnection(): Promise<{
  success: boolean
  error?: string
  stats?: MailgunStats
}> {
  try {
    await assertAdmin()

    const config = await getIntegrationConfig('mailgun')
    if (!config?.apiKey || !config?.domain) {
      return { success: false, error: 'Mailgun is nog niet geconfigureerd' }
    }

    const baseUrl = config.region === 'eu'
      ? 'https://api.eu.mailgun.net'
      : 'https://api.mailgun.net'

    const authHeader = `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`

    // Test domain connectivity
    const domainRes = await fetch(`${baseUrl}/v4/domains/${config.domain}`, {
      headers: { Authorization: authHeader },
    })

    if (!domainRes.ok) {
      const body = await domainRes.json().catch(() => ({}))
      const message = (body as any).message ?? `HTTP ${domainRes.status}`
      await setIntegrationStatus('mailgun', 'error', message)
      return { success: false, error: message }
    }

    const domainData = await domainRes.json() as { domain?: { state?: string } }
    const domainState = domainData.domain?.state ?? 'unknown'

    // Fetch 30-day stats
    const statsRes = await fetch(
      `${baseUrl}/v3/${config.domain}/stats/total?event=accepted&event=delivered&event=failed&duration=30d`,
      { headers: { Authorization: authHeader } }
    )

    let sent = 0
    let delivered = 0
    let failed = 0

    if (statsRes.ok) {
      const statsData = await statsRes.json() as {
        stats?: Array<{
          accepted?: { total?: number }
          delivered?: { total?: number }
          failed?: { total?: number }
        }>
      }
      for (const s of statsData.stats ?? []) {
        sent += s.accepted?.total ?? 0
        delivered += s.delivered?.total ?? 0
        failed += s.failed?.total ?? 0
      }
    }

    const stats: MailgunStats = { domainState, sent, delivered, failed }
    await redis.set('integration:mailgun:stats', JSON.stringify(stats), 'EX', 3600)
    await setIntegrationStatus('mailgun', 'ok')

    return { success: true, stats }
  } catch (e: any) {
    await setIntegrationStatus('mailgun', 'error', e.message).catch(() => {})
    return { success: false, error: e.message }
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "integrations/actions"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settings/integrations/actions.ts
git commit -m "feat(admin): integrations Server Actions — saveMailgunConfig, testMailgunConnection"
```

---

## Task 6: Admin UI — integrations page

**Files:**
- Create: `src/app/admin/settings/integrations/page.tsx`
- Create: `src/app/admin/settings/integrations/IntegrationsClient.tsx`

- [ ] **Step 1: Create the server page**

Create `src/app/admin/settings/integrations/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import IntegrationsClient from './IntegrationsClient'
import type { MailgunStats } from './actions'

export default async function IntegrationsPage() {
  const rows = await prisma.integration.findMany({
    select: { provider: true, status: true, lastTestedAt: true, lastError: true },
  })

  const byProvider = Object.fromEntries(rows.map(r => [r.provider, r]))

  const cachedStats = await redis.get('integration:mailgun:stats')
  const mailgunStats: MailgunStats | null = cachedStats ? JSON.parse(cachedStats) : null

  const mailgun = byProvider['mailgun'] ?? null

  return (
    <IntegrationsClient
      mailgun={mailgun ? {
        status: mailgun.status,
        lastTestedAt: mailgun.lastTestedAt?.toISOString() ?? null,
        lastError: mailgun.lastError,
      } : null}
      mailgunStats={mailgunStats}
    />
  )
}
```

- [ ] **Step 2: Create the client component**

Create `src/app/admin/settings/integrations/IntegrationsClient.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveMailgunConfig, testMailgunConnection } from './actions'
import type { MailgunStats } from './actions'
import { Lock } from 'lucide-react'

type IntegrationRow = {
  status: string
  lastTestedAt: string | null
  lastError: string | null
}

const card: React.CSSProperties = {
  background: '#161f28',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.8)',
  borderRadius: 10,
  padding: '8px 14px',
  outline: 'none',
  fontSize: 14,
  width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'rgba(255,255,255,0.35)',
  display: 'block',
  marginBottom: 6,
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    unconfigured: { label: 'Niet geconfigureerd', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)' },
    ok:           { label: 'Verbonden',           color: '#4ade80',               bg: 'rgba(34,197,94,0.12)' },
    error:        { label: 'Fout',                color: '#f87171',               bg: 'rgba(248,113,113,0.12)' },
  }
  const s = map[status] ?? map.unconfigured
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function StubCard({ name, icon }: { name: string; icon: string }) {
  return (
    <div style={{ ...card, opacity: 0.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
            Beschikbaar in Fase 7
          </span>
          <Lock size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsClient({
  mailgun,
  mailgunStats,
}: {
  mailgun: IntegrationRow | null
  mailgunStats: MailgunStats | null
}) {
  const [apiKey, setApiKey]   = useState('')
  const [domain, setDomain]   = useState('')
  const [from, setFrom]       = useState('')
  const [region, setRegion]   = useState<'eu' | 'us'>('eu')
  const [liveStats, setLiveStats] = useState<MailgunStats | null>(mailgunStats)
  const [liveStatus, setLiveStatus] = useState(mailgun?.status ?? 'unconfigured')
  const [liveError, setLiveError]   = useState(mailgun?.lastError ?? null)

  const [isSaving, startSave]   = useTransition()
  const [isTesting, startTest]  = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startSave(async () => {
      const result = await saveMailgunConfig({ apiKey, domain, from, region })
      if (result.success) {
        toast.success('Mailgun configuratie opgeslagen')
        setLiveStatus('unconfigured')
        setApiKey('')
        setDomain('')
        setFrom('')
      } else {
        toast.error(result.error ?? 'Opslaan mislukt')
      }
    })
  }

  function handleTest() {
    startTest(async () => {
      const result = await testMailgunConnection()
      if (result.success && result.stats) {
        setLiveStats(result.stats)
        setLiveStatus('ok')
        setLiveError(null)
        toast.success('Verbinding geslaagd')
      } else {
        setLiveStatus('error')
        setLiveError(result.error ?? 'Onbekende fout')
        toast.error(result.error ?? 'Verbinding mislukt')
      }
    })
  }

  const btnStyle = (color: string, disabled: boolean): React.CSSProperties => ({
    background: disabled ? 'rgba(255,255,255,0.05)' : color,
    color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
    border: 'none', borderRadius: 10, padding: '8px 16px',
    fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div style={{ maxWidth: 640 }}>
      <h1
        className="font-headline"
        style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4, letterSpacing: '-0.02em' }}
      >
        Integraties
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
        Configureer externe diensten. Gegevens worden versleuteld opgeslagen.
      </p>

      {/* Mailgun card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✉️</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>Mailgun</span>
          </div>
          <StatusBadge status={liveStatus} />
        </div>

        {liveStatus === 'error' && liveError && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f87171' }}>
            {liveError}
          </div>
        )}

        {liveStatus === 'ok' && liveStats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Verzonden (30d)', value: liveStats.sent },
              { label: 'Bezorgd', value: liveStats.delivered },
              { label: 'Mislukt', value: liveStats.failed },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {liveStatus === 'ok' && !liveStats && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
            Klik Test om statistieken te vernieuwen.
          </p>
        )}

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>API Key</label>
              <input
                type="password"
                placeholder={mailgun ? '••••••••' : 'key-...'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={inputStyle}
                autoComplete="off"
              />
            </div>
            <div>
              <label style={labelStyle}>Domain</label>
              <input
                type="text"
                placeholder={mailgun ? '••••••••' : 'mg.yourdomain.com'}
                value={domain}
                onChange={e => setDomain(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>From address</label>
            <input
              type="text"
              placeholder={mailgun ? '••••••••' : 'Dice Vault <noreply@yourdomain.com>'}
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Regio</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['eu', 'us'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
                  style={{
                    padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: region === r ? 'rgba(74,142,255,0.2)' : 'rgba(255,255,255,0.05)',
                    color: region === r ? '#4a8eff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={isSaving} style={btnStyle('#005bc0', isSaving)}>
              {isSaving ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !mailgun}
              style={btnStyle('rgba(255,255,255,0.1)', isTesting || !mailgun)}
            >
              {isTesting ? 'Testen…' : 'Test verbinding'}
            </button>
          </div>
        </form>
      </div>

      <StubCard name="Mollie" icon="💳" />
      <StubCard name="Stripe" icon="⚡" />
      <StubCard name="Strike" icon="₿" />
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "settings/integrations"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/settings/integrations/
git commit -m "feat(admin): integrations page — Mailgun config form, test connection, stub cards"
```

---

## Task 7: Add integrations shortcut to main settings page

**Files:**
- Modify: `src/app/admin/settings/SettingsClient.tsx`
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1: Add `configuredCount` prop and shortcut card to `SettingsClient`**

In `src/app/admin/settings/SettingsClient.tsx`, add `configuredCount: number` to the `Props` interface:

```typescript
interface Props {
  values: SettingsValues
  configuredCount: number
}
```

Update the function signature:

```typescript
export default function SettingsClient({ values, configuredCount }: Props) {
```

Add the shortcut card just before the submit button (before the `<button type="submit"` line near the bottom):

```typescript
{/* Integrations shortcut */}
<a
  href="/admin/settings/integrations"
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
    <div style={{ ...cardTitleStyle, marginBottom: 4 }}>Integraties</div>
    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
      {configuredCount} van 4 geconfigureerd
    </div>
  </div>
  <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</span>
</a>
```

- [ ] **Step 2: Update `settings/page.tsx` to fetch and pass `configuredCount`**

Replace the `return (` section — add the count query and pass it to `SettingsClient`. The full updated page:

```typescript
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import SettingsClient from './SettingsClient'

const DEFAULTS = {
  monthly_free_credits: 75,
  cost_game_template: 25,
  cost_league: 10,
  cost_add_player: 10,
  cost_played_game: 5,
  low_credit_threshold: 20,
  free_mode_active: false,
  free_mode_banner_nl: '',
  free_mode_banner_en: '',
}

export default async function AdminSettingsPage() {
  const [rows, configuredCount] = await Promise.all([
    prisma.adminSettings.findMany(),
    prisma.integration.count({ where: { status: 'ok' } }),
  ])

  const raw: Record<string, unknown> = {}
  for (const row of rows) {
    raw[row.key] = row.value
  }

  const values = {
    monthly_free_credits:
      typeof raw.monthly_free_credits === 'number'
        ? raw.monthly_free_credits
        : DEFAULTS.monthly_free_credits,
    cost_game_template:
      typeof raw.cost_game_template === 'number'
        ? raw.cost_game_template
        : DEFAULTS.cost_game_template,
    cost_league:
      typeof raw.cost_league === 'number' ? raw.cost_league : DEFAULTS.cost_league,
    cost_add_player:
      typeof raw.cost_add_player === 'number' ? raw.cost_add_player : DEFAULTS.cost_add_player,
    cost_played_game:
      typeof raw.cost_played_game === 'number' ? raw.cost_played_game : DEFAULTS.cost_played_game,
    low_credit_threshold:
      typeof raw.low_credit_threshold === 'number'
        ? raw.low_credit_threshold
        : DEFAULTS.low_credit_threshold,
    free_mode_active:
      typeof raw.free_mode_active === 'boolean'
        ? raw.free_mode_active
        : DEFAULTS.free_mode_active,
    free_mode_banner_nl:
      typeof raw.free_mode_banner_nl === 'string'
        ? raw.free_mode_banner_nl
        : DEFAULTS.free_mode_banner_nl,
    free_mode_banner_en:
      typeof raw.free_mode_banner_en === 'string'
        ? raw.free_mode_banner_en
        : DEFAULTS.free_mode_banner_en,
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
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
            Instellingen
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            Systeeminstellingen en kortingscodes beheren
          </p>
        </div>

        <Link
          href="/admin/settings/discount-codes"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#4a8eff',
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: 10,
            border: '1px solid rgba(74,142,255,0.25)',
            background: 'rgba(74,142,255,0.07)',
            whiteSpace: 'nowrap',
          }}
        >
          Kortingscodes →
        </Link>
      </div>

      <SettingsClient values={values} configuredCount={configuredCount} />
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "settings/SettingsClient\|settings/page"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/settings/SettingsClient.tsx src/app/admin/settings/page.tsx
git commit -m "feat(admin): add integrations shortcut card to main settings page"
```

---

## Task 8: Update `.env.example`, README, and INDEX.md

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/INDEX.md`

- [ ] **Step 1: Update `.env.example`**

Remove the three Mailgun lines and replace with a migration comment:

```bash
# Remove these lines:
# MAILGUN_API_KEY=""
# MAILGUN_DOMAIN=""
# MAILGUN_FROM="Dice Vault <noreply@dicevault.fun>"

# Add this comment block in their place:
# ─── Email (Mailgun) ─────────────────────────────────────────────
# Mailgun credentials are configured via the admin UI:
# /admin/settings/integrations
# No env vars needed.
```

- [ ] **Step 2: Update README.md env vars table**

In the "Always required" env vars table, remove the three Mailgun rows. Add a note below the table:

```markdown
> **Email (Mailgun):** Configured via `/admin/settings/integrations` — no ENV vars needed.
> `NEXTAUTH_SECRET` rotation invalidates stored integration credentials; re-enter them in the admin UI after rotating.
```

- [ ] **Step 3: Update INDEX.md**

In `docs/superpowers/plans/INDEX.md`, add a row for Phase 7A:

```markdown
| **7A** | [phase-7a-integrations-mailgun.md](2026-04-22-phase-7a-integrations-mailgun.md) | done | Integration model, AES-256-GCM encryption, Mailgun DB migration, integrations admin UI |
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: same pass/fail ratio as before this phase (14 pre-existing failures, everything else passes).

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test"
```

Expected: no output.

- [ ] **Step 6: Commit and push**

```bash
git add .env.example README.md docs/superpowers/plans/INDEX.md
git commit -m "docs: remove Mailgun ENV vars, point to admin UI, update INDEX.md"
git push origin main
```
