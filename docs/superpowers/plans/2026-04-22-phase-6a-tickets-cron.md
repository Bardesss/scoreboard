# Phase 6A — Support Tickets, Cron & Backend Plumbing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the support ticket system (user pages + admin pages), monthly credit reset cron, ticket auto-close cron, low-credit warning emails, and `requiresMfa` enforcement.

**Architecture:** Ticket + TicketMessage are new Prisma models. User pages live under `/app/support`; admin pages under `/admin/tickets`. The cron endpoint (`/api/cron/credit-reset`) handles monthly reset, free-period cleanup, and ticket auto-close in one secured GET route protected by `CRON_SECRET`. CreditPurchase + PricingRegion are added to schema now so Phase 6B's tax export page can query them (data arrives in Phase 7). The `requiresMfa` enforcement is a one-liner fix in the login action.

**Tech Stack:** Next.js 15 App Router, Prisma 5, Redis (ioredis), Mailgun, next-intl, Vitest

---

## File Map

**New files:**
- `prisma/migrations/` — auto-generated for Ticket, TicketMessage, CreditPurchase, PricingRegion
- `src/app/app/support/page.tsx` — user ticket list
- `src/app/app/support/actions.ts` — createTicket, replyToTicket
- `src/app/app/support/new/page.tsx` — new ticket form
- `src/app/app/support/[id]/page.tsx` — ticket thread + reply form
- `src/app/app/support/[id]/TicketReplyForm.tsx` — client reply form component
- `src/app/admin/tickets/page.tsx` — admin ticket list with filters
- `src/app/admin/tickets/actions.ts` — adminReplyToTicket, adminCloseTicket
- `src/app/admin/tickets/[id]/page.tsx` — admin ticket thread
- `src/app/admin/tickets/[id]/AdminTicketActions.tsx` — client reply + close actions
- `src/app/api/cron/credit-reset/route.ts` — cron: monthly reset + cleanup + auto-close
- `src/test/support-actions.test.ts` — unit tests for user ticket actions
- `src/test/admin-ticket-actions.test.ts` — unit tests for admin ticket actions
- `src/test/cron-credit-reset.test.ts` — unit tests for cron handler
- `src/test/credits-low-warning.test.ts` — unit tests for deductCreditsWithWarning
- `messages/en/emails.json` — ticket + monthly reset + low credit email strings
- `messages/nl/emails.json` — same in Dutch

**Modified files:**
- `prisma/schema.prisma` — add Ticket, TicketMessage, CreditPurchase, PricingRegion; User gains `tickets` + `creditPurchases` relations
- `src/lib/mail.ts` — add sendTicketRepliedEmail, sendTicketClosedEmail, sendTicketAutoClosedEmail, sendMonthlyResetEmail, sendLowCreditWarningEmail
- `src/lib/credits.ts` — add deductCreditsWithWarning wrapper
- `src/app/[locale]/(auth)/auth/actions.ts` — block login when requiresMfa && !totpEnabled
- `src/components/layout/Sidebar.tsx` — add Support nav item
- `src/components/layout/AdminSidebar.tsx` — add Tickets, Credits, Belasting nav items (Credits + Belasting used by 6B)
- `messages/en/app.json` — support namespace + nav.support key
- `messages/nl/app.json` — support namespace + nav.support key
- `messages/en/auth.json` — add errors.mfaRequired
- `messages/nl/auth.json` — add errors.mfaRequired
- `.env.example` — add CRON_SECRET

---

## Task 1: Schema — Add Ticket, TicketMessage, CreditPurchase, PricingRegion

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Append these models to `prisma/schema.prisma` (after the `Page` model):

```prisma
model Ticket {
  id          String          @id @default(cuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    String          // "bug" | "feedback" | "question"
  subject     String
  status      String          @default("open")  // "open" | "closed"
  autoCloseAt DateTime?
  messages    TicketMessage[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([userId, status])
  @@index([status, autoCloseAt])
}

model TicketMessage {
  id         String   @id @default(cuid())
  ticketId   String
  ticket     Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  senderType String   // "user" | "admin"
  body       String   @db.Text
  createdAt  DateTime @default(now())
}

model PricingRegion {
  id        String   @id @default(cuid())
  name      String
  currency  String
  symbol    String
  locales   String[]
  provider  String   @default("stripe")
  packs     Json
  isDefault Boolean  @default(false)
  active    Boolean  @default(true)
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  purchases CreditPurchase[]
}

model CreditPurchase {
  id                 String         @id @default(cuid())
  userId             String
  user               User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  pricingRegionId    String?
  pricingRegion      PricingRegion? @relation(fields: [pricingRegionId], references: [id])
  provider           String
  externalId         String         @unique
  credits            Int
  amountCents        Int
  currency           String
  customerCountry    String?
  customerVatNumber  String?
  eurAmountCents     Int?
  exchangeRate       Decimal?
  exchangeRateSource String?
  exchangeRateDate   DateTime?
  vatTreatment       String?
  invoiceNumber      String?        @unique
  status             String         @default("pending")
  meta               Json?
  createdAt          DateTime       @default(now())

  @@index([userId, status])
  @@index([status, createdAt])
}
```

Also add `tickets` and `creditPurchases` relations to the `User` model block, after the `notifications` relation line:

```prisma
  tickets            Ticket[]
  creditPurchases    CreditPurchase[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-tickets-creditpurchase
```

Expected: migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Verify schema compiles**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add Ticket, TicketMessage, CreditPurchase, PricingRegion models"
```

---

## Task 2: Mail helpers for tickets, cron, and low-credit warnings

**Files:**
- Modify: `src/lib/mail.ts`
- Create: `messages/en/emails.json`
- Create: `messages/nl/emails.json`

- [ ] **Step 1: Create English email strings**

Create `messages/en/emails.json`:

```json
{
  "ticket_replied": {
    "subject": "New reply to your support ticket",
    "body": "The Dice Vault support team replied to your ticket: \"{subject}\". Log in to view the reply."
  },
  "ticket_closed": {
    "subject": "Your support ticket has been closed",
    "body": "Your ticket \"{subject}\" has been closed by our support team."
  },
  "ticket_auto_closed": {
    "subject": "Your support ticket was automatically closed",
    "body": "Your ticket \"{subject}\" was automatically closed after 7 days without a reply. If you still need help, please open a new ticket."
  },
  "monthly_reset": {
    "subject": "Your monthly credits have been reset",
    "body": "Your Dice Vault monthly credits have been reset to {credits}. Enjoy another month of gaming!"
  },
  "low_credit_warning": {
    "subject": "Your Dice Vault credits are running low",
    "body": "You have {balance} credits remaining. Top up to keep logging games without interruption."
  }
}
```

- [ ] **Step 2: Create Dutch email strings**

Create `messages/nl/emails.json`:

```json
{
  "ticket_replied": {
    "subject": "Nieuw antwoord op je supportticket",
    "body": "Het Dice Vault supportteam heeft gereageerd op je ticket: \"{subject}\". Log in om het antwoord te bekijken."
  },
  "ticket_closed": {
    "subject": "Je supportticket is gesloten",
    "body": "Je ticket \"{subject}\" is gesloten door ons supportteam."
  },
  "ticket_auto_closed": {
    "subject": "Je supportticket is automatisch gesloten",
    "body": "Je ticket \"{subject}\" is automatisch gesloten na 7 dagen zonder reactie. Als je nog hulp nodig hebt, open dan een nieuw ticket."
  },
  "monthly_reset": {
    "subject": "Je maandelijkse credits zijn gereset",
    "body": "Je Dice Vault maandelijkse credits zijn gereset naar {credits}. Geniet van nog een maand gamen!"
  },
  "low_credit_warning": {
    "subject": "Je Dice Vault credits raken op",
    "body": "Je hebt nog {balance} credits. Koop meer om zonder onderbreking games te blijven bijhouden."
  }
}
```

- [ ] **Step 3: Add email helpers to mail.ts**

Append to `src/lib/mail.ts`:

```typescript
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

- [ ] **Step 4: Commit**

```bash
git add src/lib/mail.ts messages/en/emails.json messages/nl/emails.json
git commit -m "feat(mail): add ticket, monthly reset, and low-credit email helpers"
```

---

## Task 3: requiresMfa enforcement in login

**Files:**
- Modify: `src/app/[locale]/(auth)/auth/actions.ts`
- Modify: `src/test/auth-actions.test.ts`
- Modify: `messages/en/auth.json`
- Modify: `messages/nl/auth.json`

- [ ] **Step 1: Write failing test**

In `src/test/auth-actions.test.ts`, add a new test inside the `login` describe block:

```typescript
it('blocks login when requiresMfa is true and totpEnabled is false', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    ...baseUser,
    requiresMfa: true,
    totpEnabled: false,
  } as never)
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

  const formData = new FormData()
  formData.set('email', 'test@example.com')
  formData.set('password', 'password123')
  formData.set('locale', 'en')

  const result = await login(formData)
  expect(result).toEqual({ error: 'auth.errors.mfaRequired' })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/test/auth-actions.test.ts
```

Expected: FAIL — test returns `undefined` instead of `{ error: 'auth.errors.mfaRequired' }`.

- [ ] **Step 3: Add requiresMfa check**

In `src/app/[locale]/(auth)/auth/actions.ts`, find the block after `if (!valid) return { error: 'auth.errors.invalidCredentials' }` and before `if (user.totpEnabled)`. Insert:

```typescript
  if (user.requiresMfa && !user.totpEnabled) {
    return { error: 'auth.errors.mfaRequired' }
  }
```

- [ ] **Step 4: Add i18n key**

In `messages/en/auth.json`, inside the `errors` object, add:
```json
"mfaRequired": "MFA is required for your account. Please set up MFA in Settings first."
```

In `messages/nl/auth.json`, inside the `errors` object, add:
```json
"mfaRequired": "MFA is vereist voor jouw account. Stel MFA in via Instellingen."
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/test/auth-actions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/(auth)/auth/actions.ts" messages/en/auth.json messages/nl/auth.json src/test/auth-actions.test.ts
git commit -m "feat(auth): block login when requiresMfa is set but TOTP not enabled"
```

---

## Task 4: Low-credit warning in deductCredits

**Files:**
- Modify: `src/lib/credits.ts`
- Create: `src/test/credits-low-warning.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/test/credits-low-warning.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    adminSettings: { findUnique: vi.fn() },
    freePeriod: { findFirst: vi.fn() },
    creditTransaction: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/redis', () => ({ redis: { set: vi.fn().mockResolvedValue('OK') } }))
vi.mock('@/lib/mail', () => ({ sendLowCreditWarningEmail: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { sendLowCreditWarningEmail } from '@/lib/mail'
import { deductCreditsWithWarning } from '@/lib/credits'

const baseUser = {
  monthlyCredits: 25,
  permanentCredits: 0,
  isLifetimeFree: false,
}

beforeEach(() => {
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.freePeriod.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown[]) => ops)
})

describe('deductCreditsWithWarning', () => {
  it('sends low-credit warning when balance drops below threshold after deduction', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ ...baseUser, monthlyCredits: 25 } as never)
    vi.mocked(prisma.adminSettings.findUnique).mockImplementation(async ({ where: { key } }: { where: { key: string } }) => {
      if (key === 'low_credit_threshold') return { key, value: 21 }
      return null
    })

    await deductCreditsWithWarning('user-1', 'played_game', undefined, { email: 'test@example.com', locale: 'en' })

    expect(sendLowCreditWarningEmail).toHaveBeenCalledWith('test@example.com', 20, 'en')
  })

  it('does not send warning when balance is above threshold after deduction', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ ...baseUser, monthlyCredits: 50 } as never)
    vi.mocked(prisma.adminSettings.findUnique).mockImplementation(async ({ where: { key } }: { where: { key: string } }) => {
      if (key === 'low_credit_threshold') return { key, value: 20 }
      return null
    })

    await deductCreditsWithWarning('user-1', 'played_game', undefined, { email: 'test@example.com', locale: 'en' })

    expect(sendLowCreditWarningEmail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/test/credits-low-warning.test.ts
```

Expected: FAIL — `deductCreditsWithWarning` not exported.

- [ ] **Step 3: Add deductCreditsWithWarning to credits.ts**

At the top of `src/lib/credits.ts`, add to the imports:

```typescript
import { sendLowCreditWarningEmail } from '@/lib/mail'
```

Then append the new function at the bottom of the file:

```typescript
export async function deductCreditsWithWarning(
  userId: string,
  action: string,
  meta?: Prisma.InputJsonValue,
  userInfo?: { email: string; locale: string }
): Promise<{ newMonthly: number; newPermanent: number }> {
  const result = await deductCredits(userId, action, meta)

  if (userInfo) {
    const total = result.newMonthly + result.newPermanent
    const thresholdSetting = await prisma.adminSettings.findUnique({ where: { key: 'low_credit_threshold' } })
    const threshold = typeof thresholdSetting?.value === 'number' ? thresholdSetting.value : 20
    if (total < threshold) {
      await sendLowCreditWarningEmail(userInfo.email, total, userInfo.locale).catch(() => {})
    }
  }

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/test/credits-low-warning.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/credits.ts src/test/credits-low-warning.test.ts
git commit -m "feat(credits): send low-credit warning email after deduction when below threshold"
```

---

## Task 5: Cron — Monthly credit reset, free period cleanup, ticket auto-close

**Files:**
- Create: `src/app/api/cron/credit-reset/route.ts`
- Create: `src/test/cron-credit-reset.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing tests**

Create `src/test/cron-credit-reset.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn(), updateMany: vi.fn() },
    creditTransaction: { createMany: vi.fn() },
    adminSettings: { findUnique: vi.fn() },
    freePeriod: { findFirst: vi.fn() },
    ticket: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/lib/mail', () => ({
  sendMonthlyResetEmail: vi.fn(),
  sendTicketAutoClosedEmail: vi.fn(),
}))
vi.mock('@/lib/credits', () => ({ isFreeModeActive: vi.fn().mockResolvedValue(false) }))

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { sendMonthlyResetEmail, sendTicketAutoClosedEmail } from '@/lib/mail'
import { GET } from '@/app/api/cron/credit-reset/route'

const cronSecret = 'test-secret'

function makeRequest(secret = cronSecret) {
  return new Request('http://localhost/api/cron/credit-reset', {
    headers: { Authorization: `Bearer ${secret}` },
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = cronSecret
  vi.mocked(redis.set).mockResolvedValue('OK')
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'monthly_free_credits', value: 75 } as never)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown[]) => ops)
  vi.mocked(prisma.ticket.findMany).mockResolvedValue([])
  vi.mocked(prisma.user.findMany).mockResolvedValue([])
})

describe('GET /api/cron/credit-reset', () => {
  it('returns 401 when Authorization header is missing or wrong', async () => {
    const res = await GET(new Request('http://localhost/api/cron/credit-reset'))
    expect(res.status).toBe(401)

    const res2 = await GET(makeRequest('wrong-secret'))
    expect(res2.status).toBe(401)
  })

  it('returns 409 when redis lock already set (already ran this month)', async () => {
    vi.mocked(redis.set).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(409)
  })

  it('resets monthly credits for non-lifetime-free users and skips lifetime free', async () => {
    const users = [
      { id: 'u1', email: 'a@test.com', locale: 'en', monthlyCredits: 30, isLifetimeFree: false },
      { id: 'u2', email: 'b@test.com', locale: 'nl', monthlyCredits: 75, isLifetimeFree: false },
      { id: 'u3', email: 'c@test.com', locale: 'en', monthlyCredits: 100, isLifetimeFree: true },
    ]
    vi.mocked(prisma.user.findMany).mockResolvedValue(users as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reset).toBe(2)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(sendMonthlyResetEmail).toHaveBeenCalledWith('a@test.com', 75, 'en')
    expect(sendMonthlyResetEmail).toHaveBeenCalledWith('b@test.com', 75, 'nl')
    expect(sendMonthlyResetEmail).not.toHaveBeenCalledWith('c@test.com', expect.anything(), expect.anything())
  })

  it('auto-closes stale tickets and sends email', async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([
      { id: 't1', subject: 'Bug report', user: { email: 'x@test.com', locale: 'en' } },
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ticketsClosed).toBe(1)
    expect(sendTicketAutoClosedEmail).toHaveBeenCalledWith('x@test.com', 'Bug report', 'en')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/test/cron-credit-reset.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the cron route**

Create `src/app/api/cron/credit-reset/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { isFreeModeActive } from '@/lib/credits'
import { sendMonthlyResetEmail, sendTicketAutoClosedEmail } from '@/lib/mail'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('Authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lockKey = `cron:credit_reset:${monthKey}`

  const acquired = await redis.set(lockKey, '1', 'EX', 90000, 'NX')
  if (!acquired) {
    return NextResponse.json({ skipped: true, reason: 'already ran this month' }, { status: 409 })
  }

  const monthlyFreeCreditsRow = await prisma.adminSettings.findUnique({ where: { key: 'monthly_free_credits' } })
  const monthlyFreeCredits = typeof monthlyFreeCreditsRow?.value === 'number' ? monthlyFreeCreditsRow.value : 75

  const freeModeActive = await isFreeModeActive()

  const users = await prisma.user.findMany({
    select: { id: true, email: true, locale: true, monthlyCredits: true, isLifetimeFree: true },
  })

  const eligibleUsers = users.filter(u => !u.isLifetimeFree)

  await prisma.$transaction(
    eligibleUsers.flatMap(user => [
      prisma.user.update({
        where: { id: user.id },
        data: {
          monthlyCredits: freeModeActive || user.monthlyCredits >= 0
            ? monthlyFreeCredits
            : monthlyFreeCredits,
        },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: user.id,
          delta: monthlyFreeCredits - user.monthlyCredits,
          pool: 'monthly',
          reason: 'monthly_reset',
        },
      }),
    ])
  )

  for (const user of eligibleUsers) {
    await sendMonthlyResetEmail(user.email, monthlyFreeCredits, user.locale).catch(() => {})
  }

  // Auto-close stale tickets
  const staleTickets = await prisma.ticket.findMany({
    where: { status: 'open', autoCloseAt: { lt: now } },
    select: { id: true, subject: true, user: { select: { email: true, locale: true } } },
  })

  if (staleTickets.length > 0) {
    await prisma.ticket.updateMany({
      where: { id: { in: staleTickets.map(t => t.id) } },
      data: { status: 'closed', autoCloseAt: null },
    })
    for (const ticket of staleTickets) {
      await sendTicketAutoClosedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})
    }
  }

  return NextResponse.json({
    ok: true,
    reset: eligibleUsers.length,
    ticketsClosed: staleTickets.length,
    monthKey,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/cron-credit-reset.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Add CRON_SECRET to .env.example**

In `.env.example`, add:
```
CRON_SECRET=your-random-secret-here
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/ src/test/cron-credit-reset.test.ts .env.example
git commit -m "feat(cron): monthly credit reset, free period cleanup, ticket auto-close"
```

---

## Task 6: User support pages — actions

**Files:**
- Create: `src/app/app/support/actions.ts`
- Create: `src/test/support-actions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/test/support-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticket: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    ticketMessage: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createTicket, replyToTicket } from '@/app/app/support/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('createTicket', () => {
  it('creates ticket and initial message, returns ticket id', async () => {
    vi.mocked(prisma.ticket.create).mockResolvedValue({ id: 'ticket-1' } as never)

    const fd = new FormData()
    fd.set('category', 'bug')
    fd.set('subject', 'App crashes')
    fd.set('body', 'Steps to reproduce...')

    const result = await createTicket(fd)
    expect(result).toEqual({ success: true, ticketId: 'ticket-1' })
    expect(prisma.ticket.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', category: 'bug', subject: 'App crashes', status: 'open' },
    })
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', senderType: 'user', body: 'Steps to reproduce...' },
    })
  })

  it('returns error when category is invalid', async () => {
    const fd = new FormData()
    fd.set('category', 'invalid')
    fd.set('subject', 'test')
    fd.set('body', 'body')

    const result = await createTicket(fd)
    expect(result).toEqual({ success: false, error: 'Invalid category' })
  })

  it('requires auth', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const fd = new FormData()
    fd.set('category', 'bug')
    fd.set('subject', 'test')
    fd.set('body', 'body')

    const result = await createTicket(fd)
    expect(result).toEqual({ success: false, error: 'Unauthorized' })
  })
})

describe('replyToTicket', () => {
  it('creates a user message and resets autoCloseAt', async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
      id: 'ticket-1', userId: 'user-1', status: 'open',
    } as never)

    const result = await replyToTicket('ticket-1', 'My reply text')
    expect(result).toEqual({ success: true })
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', senderType: 'user', body: 'My reply text' },
    })
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ticket-1' }, data: expect.objectContaining({ autoCloseAt: expect.any(Date) }) })
    )
  })

  it('rejects reply on closed ticket', async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
      id: 'ticket-1', userId: 'user-1', status: 'closed',
    } as never)

    const result = await replyToTicket('ticket-1', 'reply')
    expect(result).toEqual({ success: false, error: 'Ticket is closed' })
  })

  it("rejects reply on another user's ticket", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
      id: 'ticket-1', userId: 'other-user', status: 'open',
    } as never)

    const result = await replyToTicket('ticket-1', 'reply')
    expect(result).toEqual({ success: false, error: 'Not found' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/test/support-actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create actions.ts**

Create `src/app/app/support/actions.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const VALID_CATEGORIES = ['bug', 'feedback', 'question'] as const

export async function createTicket(
  formData: FormData
): Promise<{ success: true; ticketId: string } | { success: false; error: string }> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const category = formData.get('category') as string
  const subject = (formData.get('subject') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()

  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return { success: false, error: 'Invalid category' }
  }
  if (!subject || !body) return { success: false, error: 'Missing fields' }

  const ticket = await prisma.ticket.create({
    data: { userId: session.user.id, category, subject, status: 'open' },
  })
  await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, senderType: 'user', body },
  })

  revalidatePath('/app/support')
  return { success: true, ticketId: ticket.id }
}

export async function replyToTicket(
  ticketId: string,
  body: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket || ticket.userId !== session.user.id) return { success: false, error: 'Not found' }
  if (ticket.status === 'closed') return { success: false, error: 'Ticket is closed' }

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await Promise.all([
    prisma.ticketMessage.create({ data: { ticketId, senderType: 'user', body } }),
    prisma.ticket.update({ where: { id: ticketId }, data: { autoCloseAt: sevenDaysFromNow } }),
  ])

  revalidatePath(`/app/support/${ticketId}`)
  return { success: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/support-actions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/support/actions.ts src/test/support-actions.test.ts
git commit -m "feat(support): user ticket actions — createTicket, replyToTicket"
```

---

## Task 7: User support pages (UI)

**Files:**
- Create: `src/app/app/support/page.tsx`
- Create: `src/app/app/support/new/page.tsx`
- Create: `src/app/app/support/[id]/page.tsx`
- Create: `src/app/app/support/[id]/TicketReplyForm.tsx`
- Modify: `messages/en/app.json`
- Modify: `messages/nl/app.json`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add i18n keys**

In `messages/en/app.json`, add a `"support"` key at the top level, and add `"support": "Support"` inside the existing `"nav"` object:

```json
"support": {
  "title": "Support",
  "newTicket": "New ticket",
  "noTickets": "No tickets yet. Have a question or found a bug? Let us know.",
  "open": "Open",
  "closed": "Closed",
  "categoryBug": "Bug",
  "categoryFeedback": "Feedback",
  "categoryQuestion": "Question",
  "subject": "Subject",
  "category": "Category",
  "message": "Message",
  "submit": "Submit",
  "reply": "Send reply",
  "replyPlaceholder": "Your reply…",
  "closedNotice": "This ticket is closed.",
  "autoCloseNotice": "This ticket will be automatically closed on {date} if no reply is received.",
  "admin": "Dice Vault Support"
}
```

In `messages/nl/app.json`, add the Dutch equivalent:

```json
"support": {
  "title": "Support",
  "newTicket": "Nieuw ticket",
  "noTickets": "Nog geen tickets. Heb je een vraag of een bug gevonden? Laat het ons weten.",
  "open": "Open",
  "closed": "Gesloten",
  "categoryBug": "Bug",
  "categoryFeedback": "Feedback",
  "categoryQuestion": "Vraag",
  "subject": "Onderwerp",
  "category": "Categorie",
  "message": "Bericht",
  "submit": "Versturen",
  "reply": "Antwoord sturen",
  "replyPlaceholder": "Jouw antwoord…",
  "closedNotice": "Dit ticket is gesloten.",
  "autoCloseNotice": "Dit ticket wordt automatisch gesloten op {date} als er geen reactie is.",
  "admin": "Dice Vault Support"
}
```

Also add `"support": "Support"` to the `nav` object in `messages/en/app.json` and `"support": "Support"` in `messages/nl/app.json`.

- [ ] **Step 2: Create ticket list page**

Create `src/app/app/support/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function SupportPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const t = await getTranslations({ locale, namespace: 'support' })

  const tickets = await prisma.ticket.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, category: true, subject: true, status: true, updatedAt: true },
  })

  const categoryLabel = (cat: string) => {
    if (cat === 'bug') return t('categoryBug')
    if (cat === 'feedback') return t('categoryFeedback')
    return t('categoryQuestion')
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>{t('title')}</h1>
        <Link
          href="/app/support/new"
          style={{ background: '#f5a623', color: '#1c1408', fontWeight: 700, fontSize: 14, padding: '8px 18px', borderRadius: 10, textDecoration: 'none' }}
        >
          {t('newTicket')}
        </Link>
      </div>

      {tickets.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>{t('noTickets')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tickets.map(ticket => (
            <Link
              key={ticket.id}
              href={`/app/support/${ticket.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(245,166,35,0.15)', color: '#f5a623', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                {categoryLabel(ticket.category)}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.87)', fontWeight: 500 }}>
                {ticket.subject}
              </span>
              <span style={{ fontSize: 12, color: ticket.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                {ticket.status === 'open' ? t('open') : t('closed')}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                {ticket.updatedAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create new ticket form**

Create `src/app/app/support/new/page.tsx`:

```typescript
'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createTicket } from '../actions'

export default function NewTicketPage() {
  const t = useTranslations('support')
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    async (_: unknown, fd: FormData) => createTicket(fd),
    null
  )

  useEffect(() => {
    if (state && state.success && 'ticketId' in state) {
      router.push(`/app/support/${state.ticketId}`)
    }
  }, [state, router])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.87)', marginBottom: 24 }}>{t('newTicket')}</h1>
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>{t('category')}</label>
          <select name="category" required style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14 }}>
            <option value="bug">{t('categoryBug')}</option>
            <option value="feedback">{t('categoryFeedback')}</option>
            <option value="question">{t('categoryQuestion')}</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>{t('subject')}</label>
          <input name="subject" required maxLength={200} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>{t('message')}</label>
          <textarea name="body" required maxLength={5000} rows={6} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        {state && !state.success && (
          <p style={{ color: '#f87171', fontSize: 13 }}>{state.error}</p>
        )}
        <button type="submit" disabled={pending} style={{ background: '#f5a623', color: '#1c1408', fontWeight: 700, fontSize: 14, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
          {pending ? '…' : t('submit')}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Create ticket detail page**

Create `src/app/app/support/[id]/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import TicketReplyForm from './TicketReplyForm'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const t = await getTranslations({ locale, namespace: 'support' })

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!ticket || ticket.userId !== session.user.id) notFound()

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>{ticket.subject}</h1>
        <span style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 600, color: ticket.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
          {ticket.status === 'open' ? t('open') : t('closed')}
        </span>
      </div>

      {ticket.status === 'open' && ticket.autoCloseAt && (
        <p style={{ fontSize: 13, color: '#fbbf24', marginBottom: 16 }}>
          {t('autoCloseNotice', { date: ticket.autoCloseAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB') })}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {ticket.messages.map(msg => {
          const isUser = msg.senderType === 'user'
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '80%', background: isUser ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isUser ? 'rgba(245,166,35,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 600 }}>
                  {isUser ? session.user.email : t('admin')}
                </p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.87)', whiteSpace: 'pre-wrap', margin: 0 }}>{msg.body}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, marginBottom: 0 }}>
                  {msg.createdAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB')}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {ticket.status === 'closed' ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{t('closedNotice')}</p>
      ) : (
        <TicketReplyForm ticketId={id} replyLabel={t('reply')} placeholder={t('replyPlaceholder')} />
      )}
    </div>
  )
}
```

Create `src/app/app/support/[id]/TicketReplyForm.tsx`:

```typescript
'use client'

import { useActionState } from 'react'
import { replyToTicket } from '../actions'

export default function TicketReplyForm({ ticketId, replyLabel, placeholder }: { ticketId: string; replyLabel: string; placeholder: string }) {
  const [state, formAction, pending] = useActionState(
    async (_: unknown, fd: FormData) => replyToTicket(ticketId, fd.get('body') as string),
    null
  )

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <textarea name="body" required maxLength={5000} rows={4} placeholder={placeholder} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
      {state && !state.success && <p style={{ color: '#f87171', fontSize: 13 }}>{state.error}</p>}
      <button type="submit" disabled={pending} style={{ alignSelf: 'flex-end', background: '#f5a623', color: '#1c1408', fontWeight: 700, fontSize: 14, padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
        {pending ? '…' : replyLabel}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Add Support link to Sidebar and update AdminSidebar**

In `src/components/layout/Sidebar.tsx`:
- Add `LifeBuoy` to the lucide-react import
- Add to the `NAV` array after `'settings'`: `{ key: 'support', href: '/app/support', icon: LifeBuoy }`

In `src/components/layout/AdminSidebar.tsx`:
- Add `MessageSquare, BarChart3, Receipt` to the lucide-react import
- Add to the `NAV` array after `'Goedkeuringen'`:

```typescript
  { label: 'Tickets',   href: '/admin/tickets',            icon: MessageSquare, exact: false },
  { label: 'Credits',   href: '/admin/credits',            icon: BarChart3,     exact: false },
  { label: 'Belasting', href: '/admin/billing/tax-export', icon: Receipt,       exact: false },
```

- [ ] **Step 6: Commit**

```bash
git add src/app/app/support/ src/components/layout/Sidebar.tsx src/components/layout/AdminSidebar.tsx messages/en/app.json messages/nl/app.json
git commit -m "feat(support): user ticket list, new ticket form, and thread view"
```

---

## Task 8: Admin ticket actions

**Files:**
- Create: `src/app/admin/tickets/actions.ts`
- Create: `src/test/admin-ticket-actions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/test/admin-ticket-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticket: { findUnique: vi.fn(), update: vi.fn() },
    ticketMessage: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/mail', () => ({
  sendTicketRepliedEmail: vi.fn(),
  sendTicketClosedEmail: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendTicketRepliedEmail, sendTicketClosedEmail } from '@/lib/mail'
import { adminReplyToTicket, adminCloseTicket } from '@/app/admin/tickets/actions'

const adminSession = { user: { id: 'admin-1', email: 'admin@test.com', locale: 'en', role: 'admin' } }
const openTicket = {
  id: 'ticket-1', subject: 'Help!', status: 'open',
  user: { id: 'user-1', email: 'user@test.com', locale: 'en' },
}

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(adminSession as never)
})

describe('adminReplyToTicket', () => {
  it('creates admin message, sets autoCloseAt, sends email', async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(openTicket as never)

    const result = await adminReplyToTicket('ticket-1', 'Here is the answer')
    expect(result).toEqual({ success: true })
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', senderType: 'admin', body: 'Here is the answer' },
    })
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ticket-1' }, data: expect.objectContaining({ autoCloseAt: expect.any(Date) }) })
    )
    expect(sendTicketRepliedEmail).toHaveBeenCalledWith('user@test.com', 'Help!', 'en')
  })

  it('rejects non-admin user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', role: 'user' } } as never)
    const result = await adminReplyToTicket('ticket-1', 'body')
    expect(result).toEqual({ success: false, error: 'Unauthorized' })
  })
})

describe('adminCloseTicket', () => {
  it('closes ticket and sends email', async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(openTicket as never)
    const result = await adminCloseTicket('ticket-1')
    expect(result).toEqual({ success: true })
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-1' }, data: { status: 'closed', autoCloseAt: null },
    })
    expect(sendTicketClosedEmail).toHaveBeenCalledWith('user@test.com', 'Help!', 'en')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/test/admin-ticket-actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create admin ticket actions**

Create `src/app/admin/tickets/actions.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTicketRepliedEmail, sendTicketClosedEmail } from '@/lib/mail'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function adminReplyToTicket(
  ticketId: string,
  body: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!await requireAdmin()) return { success: false, error: 'Unauthorized' }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { email: true, locale: true } } },
  })
  if (!ticket || ticket.status === 'closed') return { success: false, error: 'Not found or closed' }

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await Promise.all([
    prisma.ticketMessage.create({ data: { ticketId, senderType: 'admin', body } }),
    prisma.ticket.update({ where: { id: ticketId }, data: { autoCloseAt: sevenDaysFromNow } }),
  ])

  await sendTicketRepliedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})

  revalidatePath(`/admin/tickets/${ticketId}`)
  return { success: true }
}

export async function adminCloseTicket(
  ticketId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!await requireAdmin()) return { success: false, error: 'Unauthorized' }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { email: true, locale: true } } },
  })
  if (!ticket) return { success: false, error: 'Not found' }

  await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'closed', autoCloseAt: null } })
  await sendTicketClosedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})

  revalidatePath('/admin/tickets')
  revalidatePath(`/admin/tickets/${ticketId}`)
  return { success: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/admin-ticket-actions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tickets/actions.ts src/test/admin-ticket-actions.test.ts
git commit -m "feat(admin): ticket actions — reply, close, email notifications"
```

---

## Task 9: Admin ticket pages (UI)

**Files:**
- Create: `src/app/admin/tickets/page.tsx`
- Create: `src/app/admin/tickets/[id]/page.tsx`
- Create: `src/app/admin/tickets/[id]/AdminTicketActions.tsx`

- [ ] **Step 1: Create admin ticket list**

Create `src/app/admin/tickets/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>
}) {
  const { status = 'all', category = 'all' } = await searchParams

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.status = status
  if (category !== 'all') where.category = category

  const [tickets, unreadCount] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.ticket.count({
      where: { status: 'open', messages: { every: { senderType: 'user' } } },
    }),
  ])

  const categoryLabel = (cat: string) =>
    cat === 'bug' ? 'Bug' : cat === 'feedback' ? 'Feedback' : 'Vraag'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>Tickets</h1>
        {unreadCount > 0 && (
          <span style={{ background: '#f5a623', color: '#1c1408', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
            {unreadCount} ongelezen
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'open', 'closed'] as const).map(s => (
          <Link key={s} href={`/admin/tickets?status=${s}&category=${category}`} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: status === s ? 'rgba(245,166,35,0.2)' : 'rgba(255,255,255,0.05)', color: status === s ? '#f5a623' : 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
            {s === 'all' ? 'Alle' : s === 'open' ? 'Open' : 'Gesloten'}
          </Link>
        ))}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
        {(['all', 'bug', 'feedback', 'question'] as const).map(c => (
          <Link key={c} href={`/admin/tickets?status=${status}&category=${c}`} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: category === c ? 'rgba(74,142,255,0.2)' : 'rgba(255,255,255,0.05)', color: category === c ? '#4a8eff' : 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
            {c === 'all' ? 'Alle categorieën' : categoryLabel(c)}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tickets.length === 0 && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Geen tickets gevonden.</p>}
        {tickets.map(ticket => {
          const needsReply = ticket.messages[0]?.senderType === 'user'
          return (
            <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: needsReply ? 'rgba(245,166,35,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${needsReply ? 'rgba(245,166,35,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, textDecoration: 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                {categoryLabel(ticket.category)}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>{ticket.user.email}</span>
              <span style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.87)', fontWeight: needsReply ? 600 : 400 }}>{ticket.subject}</span>
              <span style={{ fontSize: 12, color: ticket.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)', fontWeight: 600, flexShrink: 0 }}>
                {ticket.status === 'open' ? 'Open' : 'Gesloten'}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{ticket.updatedAt.toLocaleDateString('nl-NL')}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create admin ticket detail page**

Create `src/app/admin/tickets/[id]/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import AdminTicketActions from './AdminTicketActions'

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, locale: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!ticket) notFound()

  const now = new Date()
  const autoCloseMs = ticket.autoCloseAt ? ticket.autoCloseAt.getTime() - now.getTime() : null
  const autoCloseDays = autoCloseMs !== null ? Math.ceil(autoCloseMs / (1000 * 60 * 60 * 24)) : null

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>{ticket.subject}</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          {ticket.user.email} · {ticket.category} ·{' '}
          <span style={{ color: ticket.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
            {ticket.status === 'open' ? 'Open' : 'Gesloten'}
          </span>
        </p>
        {autoCloseDays !== null && ticket.status === 'open' && (
          <p style={{ fontSize: 12, color: autoCloseDays <= 1 ? '#fbbf24' : 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            Auto-sluit over {autoCloseDays} dag{autoCloseDays !== 1 ? 'en' : ''}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {ticket.messages.map(msg => {
          const isUser = msg.senderType === 'user'
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-start' : 'flex-end' }}>
              <div style={{ maxWidth: '80%', background: isUser ? 'rgba(255,255,255,0.06)' : 'rgba(74,142,255,0.12)', border: `1px solid ${isUser ? 'rgba(255,255,255,0.08)' : 'rgba(74,142,255,0.25)'}`, borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 600 }}>
                  {isUser ? ticket.user.email : 'Admin'}
                </p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.87)', whiteSpace: 'pre-wrap', margin: 0 }}>{msg.body}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, marginBottom: 0 }}>{msg.createdAt.toLocaleDateString('nl-NL')}</p>
              </div>
            </div>
          )
        })}
      </div>

      <AdminTicketActions ticketId={id} status={ticket.status} />
    </div>
  )
}
```

Create `src/app/admin/tickets/[id]/AdminTicketActions.tsx`:

```typescript
'use client'

import { useActionState, useState } from 'react'
import { adminReplyToTicket, adminCloseTicket } from '../actions'

export default function AdminTicketActions({ ticketId, status }: { ticketId: string; status: string }) {
  const [showClose, setShowClose] = useState(false)
  const [replyState, replyAction, replyPending] = useActionState(
    async (_: unknown, fd: FormData) => adminReplyToTicket(ticketId, fd.get('body') as string),
    null
  )
  const [closeState, closeAction, closePending] = useActionState(
    async () => adminCloseTicket(ticketId),
    null
  )

  if (status === 'closed') {
    return <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Dit ticket is gesloten.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form action={replyAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea name="body" required rows={4} placeholder="Antwoord typen…" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        {replyState && !replyState.success && <p style={{ color: '#f87171', fontSize: 13 }}>{replyState.error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={replyPending} style={{ background: '#4a8eff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
            {replyPending ? '…' : 'Stuur antwoord'}
          </button>
          {!showClose ? (
            <button type="button" onClick={() => setShowClose(true)} style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 14, padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              Ticket sluiten
            </button>
          ) : (
            <form action={closeAction} style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={closePending} style={{ background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {closePending ? '…' : 'Bevestig sluiten'}
              </button>
              <button type="button" onClick={() => setShowClose(false)} style={{ background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '9px 14px', border: 'none', cursor: 'pointer' }}>
                Annuleer
              </button>
            </form>
          )}
        </div>
      </form>
      {closeState && !closeState.success && <p style={{ color: '#f87171', fontSize: 13 }}>{closeState.error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit + push**

```bash
git add src/app/admin/tickets/
git commit -m "feat(admin): ticket list and thread pages with reply and close"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ `requiresMfa` enforcement — blocks login when flag set but TOTP not configured
- ✅ Low-credit warning email — fires post-deduction via `deductCreditsWithWarning`
- ✅ Monthly credit reset cron with Redis lock + monthly_reset email
- ✅ Free period end cleanup (negative monthly → reset to configured value at cron time)
- ✅ Ticket auto-close cron + `ticket_auto_closed` email
- ✅ Support ticket system: user pages (`/app/support`), admin pages (`/admin/tickets`)
- ✅ AdminSidebar updated with Tickets, Credits, Belasting links (Credits + Belasting for Phase 6B)
- ✅ Sidebar updated with Support link
- ✅ All tests written TDD-style before implementation

**Deferred to Phase 6B:**
- Credit analytics dashboard (`/admin/credits`) — requires Recharts install
- Tax export scaffold (`/admin/billing/tax-export`)
- README final review + INDEX.md update
- Final push (6B does this)
