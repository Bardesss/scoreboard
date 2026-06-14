# Security Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every confirmed finding from the 2026-06-14 security audit — MFA bypass, missing security headers, email HTML injection, cross-tenant stat injection, secret-handling, and the medium/low hardening items.

**Architecture:** Mostly small, contained changes to existing files. Two findings need a tiny refactor to become testable (extract credential authorization into a pure function; centralize HTML escaping). Encryption stays keyed off `NEXTAUTH_SECRET` (introducing a separate key would orphan already-encrypted integration secrets — noted as out-of-scope future work). The IP-trust and rate-limit changes are fail-open to preserve availability.

**Tech Stack:** Next.js 15 (App Router), NextAuth v5 (JWT), Prisma + Postgres, Redis (ioredis), bcryptjs, Vitest.

**Conventions:**
- Run a single test file with `npx vitest run <path>`.
- Type-check with `npx tsc --noEmit` (build skips it by design — there are ~16 pre-existing test-mock type errors unrelated to this work; do not be alarmed if they persist, just ensure you add none).
- Commit after each task. Push only when the user asks (per project policy: commit to `main` directly, no PRs).

**Decisions baked in (no further input needed):**
- Login/TOTP throttle thresholds: login 10 fails / 15 min per email; TOTP 5 attempts per pending token.
- Unverified-purge style cron stays as-is (already shipped; the audit's "replayable delete" concern was overstated).
- CSP ships in pragmatic form (`'unsafe-inline'` allowed for script/style because Next injects inline bootstrap + the app uses inline `style={{}}`); nonce-based strict CSP is future hardening. `frame-ancestors 'none'` is the key clickjacking win and is safe.

---

## Phase 1 — Critical / High

### Task 1: Close the MFA bypass (enforce TOTP inside `authorize`)

**Problem:** `authorize()` returns a full session for valid email+password without checking `totpEnabled`/`requiresMfa`. The TOTP gate only exists in the `login` server action, so a direct POST to `/api/auth/callback/credentials` skips it.

**Files:**
- Create: `src/lib/authorize.ts`
- Modify: `src/lib/auth.ts:14-60`
- Test: `src/lib/authorize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/authorize.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() } }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn().mockResolvedValue(true) } }))

import { prisma } from '@/lib/prisma'
import { authorizeCredentials } from './authorize'

const baseUser = {
  id: 'u1', email: 'a@b.com', role: 'user', locale: 'en',
  passwordHash: 'h', emailVerified: new Date(),
  totpEnabled: false, requiresMfa: false,
}

beforeEach(() => { vi.clearAllMocks() })

describe('authorizeCredentials — password path', () => {
  it('returns null when the account has TOTP enabled (must use the verified-token path)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, totpEnabled: true } as never)
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'secret-password' })
    expect(result).toBeNull()
  })

  it('returns null when requiresMfa is set but TOTP is not yet enabled', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, requiresMfa: true, totpEnabled: false } as never)
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'secret-password' })
    expect(result).toBeNull()
  })

  it('returns the user when no MFA is configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never)
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'secret-password' })
    expect(result).toMatchObject({ id: 'u1', email: 'a@b.com' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/authorize.test.ts`
Expected: FAIL — `authorizeCredentials` not found.

- [ ] **Step 3: Create the extracted, hardened authorize function**

```ts
// src/lib/authorize.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type SessionUser = {
  id: string; email: string; role: string; locale: string
  totpEnabled: boolean; requiresMfa: boolean
}

function toSessionUser(u: {
  id: string; email: string; role: string; locale: string; totpEnabled: boolean; requiresMfa: boolean
}): SessionUser {
  return { id: u.id, email: u.email, role: u.role, locale: u.locale, totpEnabled: u.totpEnabled, requiresMfa: u.requiresMfa }
}

export async function authorizeCredentials(
  credentials: Partial<Record<'email' | 'password' | 'totpVerifiedToken', unknown>>,
): Promise<SessionUser | null> {
  // Path A: a one-time token minted only after a successful TOTP challenge.
  if (credentials.totpVerifiedToken) {
    const userId = await redis.get(`totp_verified:${credentials.totpVerifiedToken as string}`)
    if (!userId) return null
    await redis.del(`totp_verified:${credentials.totpVerifiedToken as string}`)
    const user = await prisma.user.findUnique({ where: { id: userId as string } })
    if (!user) return null
    return toSessionUser(user)
  }

  // Path B: raw email + password. This path must REFUSE any account that has
  // MFA, otherwise the second factor can be skipped by calling the credentials
  // callback directly. Such accounts may only authenticate via Path A.
  const parsed = loginSchema.safeParse(credentials)
  if (!parsed.success) return null

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!user || !user.emailVerified) return null

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!valid) return null

  // SECURITY: enforce MFA here, not just in the login server action.
  if (user.totpEnabled || user.requiresMfa) return null

  return toSessionUser(user)
}
```

- [ ] **Step 4: Wire it into NextAuth, replacing the inline authorize**

```ts
// src/lib/auth.ts — replace the inline authorize body with a call to the extracted fn
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/lib/auth.config'
import { authorizeCredentials } from '@/lib/authorize'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, totpVerifiedToken: {} },
      authorize: (credentials) => authorizeCredentials(credentials),
    }),
  ],
})
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/lib/authorize.test.ts src/test/auth-actions.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — add no new errors in `auth.ts`/`authorize.ts`.

> NOTE: The `login` server action keeps its TOTP redirect (good UX), but it is no longer the security boundary. Verify the happy-path TOTP login still works after this change (login → totp-challenge → success).

- [ ] **Step 6: Commit**

```bash
git add src/lib/authorize.ts src/lib/authorize.test.ts src/lib/auth.ts
git commit -m "fix(security): enforce MFA inside credentials authorize (close TOTP bypass)"
```

---

### Task 2: Add a per-account login throttle

**Problem:** Rate limiting is IP-keyed only; an attacker (esp. with spoofable IP, Task 6) gets unlimited password guesses against one account.

**Files:**
- Modify: `src/lib/authorize.ts` (the password path from Task 1)
- Test: `src/lib/authorize.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

```ts
// add to src/lib/authorize.test.ts
import { redis } from '@/lib/redis'

describe('authorizeCredentials — per-account throttle', () => {
  it('returns null without checking the password once the email is locked', async () => {
    vi.mocked(redis.incr).mockResolvedValue(11) // over the 10 limit
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never)
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'whatever-password' })
    expect(result).toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/authorize.test.ts`
Expected: FAIL — currently no throttle, `findUnique` is called.

- [ ] **Step 3: Implement the email-keyed throttle in the password path**

Add near the top of Path B in `src/lib/authorize.ts` (before `prisma.user.findUnique`):

```ts
  const email = (credentials.email as string | undefined)?.trim().toLowerCase()
  if (email) {
    // Fail-open email-keyed lockout: 10 attempts / 15 min. Independent of IP.
    try {
      const key = `loginfail:${email}`
      const hits = await redis.incr(key)
      if (hits === 1) await redis.expire(key, 15 * 60)
      if (hits > 10) return null
    } catch { /* redis down → don't block logins */ }
  }
```

And after a SUCCESSFUL password compare (before returning the user, in both the no-MFA return), clear the counter:

```ts
  try { if (email) await redis.del(`loginfail:${email}`) } catch { /* ignore */ }
```

> Place the `del` immediately before `return toSessionUser(user)` in Path B.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/authorize.test.ts`
Expected: PASS (all cases). Adjust the earlier Task 1 tests if needed by setting `vi.mocked(redis.incr).mockResolvedValue(1)` in their `beforeEach` so they aren't seen as locked.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authorize.ts src/lib/authorize.test.ts
git commit -m "fix(security): add per-account login attempt throttle"
```

---

### Task 3: Add global security headers

**Problem:** No CSP, HSTS, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy anywhere. Enables clickjacking, MIME-sniffing, referrer token leakage.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add an `async headers()` block**

```ts
// next.config.ts — add inside the nextConfig object
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next injects inline bootstrap/hydration scripts; app uses inline styles.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
```

- [ ] **Step 2: Build and smoke-test the app**

Run: `npx next build` may OOM on low-RAM machines; instead run dev: `npx next dev` and load the marketing page, `/app/dashboard`, and `/admin`. Confirm no console CSP violations break rendering (inline styles, images, fonts, the QR data-URL on TOTP setup, hero media). If a legitimate resource is blocked, add its source to the matching CSP directive — do not remove `frame-ancestors 'none'`.

- [ ] **Step 3: Verify headers are present**

Run (dev server up): `curl -sI http://localhost:3000/en | grep -i -E "content-security|x-frame|x-content-type|referrer-policy|strict-transport"`
Expected: all five headers present.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add CSP and security response headers"
```

---

### Task 4: Escape user data in emails + cap input lengths

**Problem:** League name and ticket subject are interpolated into email HTML unescaped; the league-name case reaches a *different* user (phishing vector).

**Files:**
- Modify: `src/lib/emailTemplates.ts` (add `escapeHtml`, wrap every user/DB value)
- Modify: `src/lib/mail.ts` (escape interpolated values in ticket emails + verification link uses fixed tokens, but escape `subject` usages)
- Modify: `src/app/app/leagues/actions.ts` (cap league name length)
- Modify: `src/app/app/support/actions.ts` (cap ticket subject length)
- Test: `src/lib/emailTemplates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/emailTemplates.test.ts
import { describe, it, expect } from 'vitest'
import { escapeHtml, playedGameApprovedEmail, connectionRequestEmail } from './emailTemplates'

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })
})

describe('email templates escape interpolated values', () => {
  it('escapes a malicious league name', () => {
    const { html } = playedGameApprovedEmail('en', '<script>alert(1)</script>')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes a malicious actor name', () => {
    const { html } = connectionRequestEmail('en', '<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img src=x')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/emailTemplates.test.ts`
Expected: FAIL — `escapeHtml` not exported; raw HTML present.

- [ ] **Step 3: Add `escapeHtml` and apply it to every interpolated value**

```ts
// src/lib/emailTemplates.ts — add at top
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

Then wrap **every** interpolated dynamic value in the template bodies and subjects with `escapeHtml(...)`. Specifically:
- `connectionRequestEmail`: `escapeHtml(fromName)` (both locales).
- `connectionAcceptedEmail`: `escapeHtml(toName)`.
- `playedGamePendingEmail`: `escapeHtml(submitterName)`, `escapeHtml(leagueName)`.
- `playedGameApprovedEmail` / `playedGameRejectedEmail`: `escapeHtml(leagueName)`.
- `connectionGameLoggedEmail`: `escapeHtml(actorEmail)`, `escapeHtml(leagueName)`.
- `reactionReceivedEmail`: `escapeHtml(actorEmail)`; leave `emoji` (it is allow-list validated upstream) but escaping it is harmless — escape it too.

Example for `playedGameApprovedEmail` (en branch):

```ts
`<p>Your submitted game in league <strong>${escapeHtml(leagueName)}</strong> has been approved.</p>`
```

- [ ] **Step 4: Escape ticket subject in `mail.ts`**

In `src/lib/mail.ts`, import and apply escaping to the interpolated `subject` in `sendTicketRepliedEmail`, `sendTicketClosedEmail`, and `sendTicketAutoClosedEmail`:

```ts
import { escapeHtml } from '@/lib/emailTemplates'
// ...inside each: use ${escapeHtml(subject)} wherever subject is embedded in HTML body
```

- [ ] **Step 5: Cap input lengths at the source**

In `src/app/app/leagues/actions.ts` `createLeague` and `updateLeague`, after trimming `name`:

```ts
const name = (input.name ?? '').trim()
if (!name) return { success: false, error: 'required' }
if (name.length > 80) return { success: false, error: 'nameTooLong' }
```

In `src/app/app/support/actions.ts` `createTicket`, after trimming `subject`:

```ts
if (subject.length > 150) return { success: false, error: 'Subject too long' }
```

(Confirm the exact existing variable names while editing; add the `nameTooLong` key to `messages/en/app.json` + `messages/nl/app.json` if the league form surfaces it.)

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/lib/emailTemplates.test.ts src/test/leagues-actions.test.ts`
Expected: PASS. Then `npx tsc --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/emailTemplates.ts src/lib/emailTemplates.test.ts src/lib/mail.ts src/app/app/leagues/actions.ts src/app/app/support/actions.ts messages/
git commit -m "fix(security): HTML-escape user data in emails and cap input lengths"
```

---

### Task 5: Validate participant IDs against league membership (close stat-injection IDOR)

**Problem:** `logPlayedGame` / `editPlayedGame` build score rows from client `playerId`s with no membership check, letting a league owner attach score rows to any user's Player (polluting victims' public stats).

**Files:**
- Modify: `src/app/app/leagues/[id]/actions.ts` (`logPlayedGame` ~line 50, `editPlayedGame` ~line 200)
- Test: `src/test/leagues-session-actions.test.ts` (or a new `src/test/log-played-game-idor.test.ts`)

Membership model (confirmed): `LeagueMember { leagueId, playerId }`, unique on `[leagueId, playerId]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/test/log-played-game-idor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    leagueMember: { findMany: vi.fn() },
    playedGame: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'owner' } }) }))
vi.mock('@/lib/credits', () => ({
  checkRateLimit: vi.fn(), deductCredits: vi.fn(),
  InsufficientCreditsError: class extends Error {},
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { prisma } from '@/lib/prisma'

beforeEach(() => { vi.clearAllMocks() })

it('rejects a participant that is not a league member', async () => {
  vi.mocked(prisma.league.findUnique).mockResolvedValue({
    id: 'L1', ownerId: 'owner',
    gameTemplate: { winType: 'winner', winCondition: null, scoreFields: [], roles: [], missions: [], trackDifficulty: false, trackTeamScores: false, trackEliminationOrder: false, timeUnit: null },
  } as never)
  vi.mocked(prisma.leagueMember.findMany).mockResolvedValue([{ playerId: 'p-legit' }] as never)

  const { logPlayedGame } = await import('@/app/app/leagues/[id]/actions')
  const result = await logPlayedGame('L1', {
    playedAt: new Date(), notes: '',
    resolverInput: { participantIds: ['p-legit', 'p-victim'], winnerId: 'p-legit' },
  } as never)

  expect(result).toEqual({ success: false, error: 'notFound' })
  expect(prisma.$transaction).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/log-played-game-idor.test.ts`
Expected: FAIL — the foreign participant is currently accepted.

- [ ] **Step 3: Add the membership check (both actions)**

In `logPlayedGame`, after the `if (!resolved.ok) ...` line and before the credit/rate-limit block, add:

```ts
  const memberIds = new Set(
    (await prisma.leagueMember.findMany({
      where: { leagueId },
      select: { playerId: true },
    })).map(m => m.playerId)
  )
  if (resolved.scoreEntries.some(e => !memberIds.has(e.playerId))) {
    return { success: false, error: 'notFound' }
  }
```

Apply the identical guard in `editPlayedGame` (after its score entries are resolved, before persisting). Use the played game's `leagueId` there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/log-played-game-idor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/app/leagues/[id]/actions.ts" src/test/log-played-game-idor.test.ts
git commit -m "fix(security): validate participant IDs against league membership (IDOR)"
```

---

### Task 6: Remove the committed secret default + fail fast on weak `NEXTAUTH_SECRET`

**Problem:** `docker-compose.yml` ships `NEXTAUTH_SECRET: change_me_in_production`, and that secret also derives the encryption key for stored integration credentials. No boot validation.

**Files:**
- Modify: `docker-compose.yml:37`
- Modify: `src/lib/encryption.ts` (fail-fast guard)
- Test: `src/lib/encryption.test.ts`

> Encryption stays keyed off `NEXTAUTH_SECRET` to avoid orphaning already-encrypted integration secrets. A dedicated `ENCRYPTION_KEY` with a re-encryption migration is future work — note it in the commit body, do not do it here.

- [ ] **Step 1: Require env interpolation in compose (no literal secret)**

```yaml
# docker-compose.yml — replace line 37
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?NEXTAUTH_SECRET must be set}
```

Also remove the host port mappings for `db` and `redis` (keep them on the internal network) unless this compose is used for local dev only — if local-only, add a comment saying so and leave ports. Recommended: delete `ports:` under `db` and `redis`.

- [ ] **Step 2: Write the failing test for the boot guard**

```ts
// src/lib/encryption.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => { vi.unstubAllEnvs() })

describe('encryption key guard', () => {
  it('throws when NEXTAUTH_SECRET is missing or weak', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'short')
    vi.resetModules()
    const mod = await import('./encryption')
    expect(() => mod.encrypt('x')).toThrow(/NEXTAUTH_SECRET/)
  })

  it('round-trips when the secret is strong', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'a'.repeat(32))
    vi.resetModules()
    const mod = await import('./encryption')
    expect(mod.decrypt(mod.encrypt('hello'))).toBe('hello')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/encryption.test.ts`
Expected: FAIL — no guard, weak secret does not throw.

- [ ] **Step 4: Add the guard in `deriveKey`**

```ts
// src/lib/encryption.ts
function deriveKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 32 || secret === 'change_me_in_production') {
    throw new Error('NEXTAUTH_SECRET must be set to a strong value (>= 32 chars) before using encryption')
  }
  return createHash('sha256').update(secret).digest()
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/encryption.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml src/lib/encryption.ts src/lib/encryption.test.ts
git commit -m "fix(security): remove committed secret default; fail fast on weak NEXTAUTH_SECRET"
```

> **Manual follow-up (not a code step):** Confirm the production Coolify env sets a strong unique `NEXTAUTH_SECRET` (and `REDIS_URL`, `DATABASE_URL`). If it was ever running the compose default, rotate it (note: rotating invalidates all sessions and makes existing encrypted integration secrets undecryptable — re-enter integration keys in admin after rotation).

---

## Phase 2 — Medium

### Task 7: Stop trusting client-supplied `x-forwarded-for`

**Problem:** `getClientIp` takes the leftmost (client-settable) XFF entry, so all IP rate limits are spoofable per-request.

**Files:**
- Modify: `src/lib/auth-rate-limit.ts:7-21`
- Test: `src/lib/auth-rate-limit.test.ts` (extend the existing `getClientIp` tests)

Trust model: Coolify/Traefik appends the real peer to XFF, so the **right-most** `TRUSTED_PROXY_COUNT` entries are proxy-controlled and trustworthy. Default 1 trusted hop → take the last entry.

- [ ] **Step 1: Update the existing test expectations**

```ts
// src/lib/auth-rate-limit.test.ts — replace the "first x-forwarded-for entry" test
it('uses the proxy-trusted (right-most) x-forwarded-for entry', async () => {
  mockHeaders.get.mockImplementation((h: string) =>
    h === 'x-forwarded-for' ? '1.1.1.1, 2.2.2.2, 3.3.3.3' : null)
  const { getClientIp } = await import('./auth-rate-limit')
  // default TRUSTED_PROXY_COUNT = 1 → last hop (3.3.3.3) is the one our proxy set
  expect(await getClientIp()).toBe('3.3.3.3')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth-rate-limit.test.ts`
Expected: FAIL — currently returns `1.1.1.1`.

- [ ] **Step 3: Implement trusted-hop selection**

```ts
// src/lib/auth-rate-limit.ts — replace getClientIp
export async function getClientIp(): Promise<string> {
  const h = await headers()
  const trustedHops = Math.max(1, Number(process.env.TRUSTED_PROXY_COUNT) || 1)
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',').map(s => s.trim()).filter(Boolean)
    // The right-most `trustedHops` entries are set by our own proxy chain and
    // cannot be forged by the client; pick the left-most of those.
    const idx = Math.max(0, parts.length - trustedHops)
    if (parts[idx]) return parts[idx]
  }
  return h.get('x-real-ip')?.trim() || 'unknown'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth-rate-limit.test.ts`
Expected: PASS (keep the existing x-real-ip and 'unknown' fallback tests passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-rate-limit.ts src/lib/auth-rate-limit.test.ts
git commit -m "fix(security): derive client IP from trusted proxy hop, not client XFF"
```

> **Manual follow-up:** Verify against the real deployment what Coolify/Traefik puts in `x-forwarded-for` (curl an echo route or inspect logs). If a CDN (e.g. Cloudflare) sits in front, set `TRUSTED_PROXY_COUNT` accordingly or switch to the CDN's connecting-IP header.

---

### Task 8: Limit TOTP verification attempts

**Problem:** `verifyTotp` lets an attacker submit unlimited code/backup-code guesses within the 300s pending-token window.

**Files:**
- Modify: `src/app/[locale]/(auth)/auth/actions.ts` (`verifyTotp` ~line 132-164)
- Test: `src/test/auth-actions.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

```ts
// add to src/test/auth-actions.test.ts (redis mock already present; add incr/expire to it)
describe('verifyTotp throttle', () => {
  it('locks the pending token after too many failed attempts', async () => {
    const { redis } = await import('@/lib/redis')
    vi.mocked(redis.get).mockResolvedValue('user-1')   // pending token resolves
    vi.mocked(redis.incr).mockResolvedValue(6)          // over the 5 limit

    const { verifyTotp } = await import('@/app/[locale]/(auth)/auth/actions')
    const fd = new FormData()
    fd.set('token', 'pending'); fd.set('code', '000000'); fd.set('locale', 'en')
    const result = await verifyTotp(fd)
    expect(result).toEqual({ error: 'auth.totp.invalid' })
  })
})
```

Update the redis mock in that file to include `incr: vi.fn().mockResolvedValue(1)` and `expire: vi.fn()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/auth-actions.test.ts`
Expected: FAIL — no attempt limiting yet.

- [ ] **Step 3: Add the attempt counter in `verifyTotp`**

After resolving `userId` from `totp_pending` and before verifying the code:

```ts
  const attemptsKey = `totp_attempts:${pendingToken}`
  const attempts = await redis.incr(attemptsKey)
  if (attempts === 1) await redis.expire(attemptsKey, 300)
  if (attempts > 5) {
    await redis.del(`totp_pending:${pendingToken}`)
    await redis.del(attemptsKey)
    return { error: 'auth.totp.invalid' }
  }
```

On successful verification, also `await redis.del(attemptsKey)` alongside the existing `redis.del(totp_pending...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/auth-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/(auth)/auth/actions.ts" src/test/auth-actions.test.ts
git commit -m "fix(security): cap TOTP verification attempts per pending token"
```

---

### Task 9: Encrypt the TOTP secret at rest

**Problem:** `totpSecret` is stored plaintext; a DB read yields all users' TOTP seeds.

**Files:**
- Modify: `src/app/app/settings/actions.ts` (`confirmTotpSetup` write; `verifyCurrentTotp` read)
- Modify: `src/app/[locale]/(auth)/auth/actions.ts` (`verifyTotp` reads `user.totpSecret`)
- Create: `src/lib/totpSecret.ts` (encrypt/decrypt with plaintext backward-compat)
- Test: `src/lib/totpSecret.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/totpSecret.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/encryption', () => ({
  encrypt: (s: string) => `aa:bb:${Buffer.from(s).toString('hex')}`,
  decrypt: (c: string) => Buffer.from(c.split(':')[2], 'hex').toString('utf8'),
}))
import { encryptTotpSecret, decryptTotpSecret } from './totpSecret'

beforeEach(() => vi.clearAllMocks())

it('round-trips an encrypted secret', () => {
  expect(decryptTotpSecret(encryptTotpSecret('JBSWY3DP'))).toBe('JBSWY3DP')
})

it('reads a legacy plaintext secret unchanged (backward compat)', () => {
  // a raw base32 secret has no colon-delimited cipher shape
  expect(decryptTotpSecret('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/totpSecret.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/totpSecret.ts
import { encrypt, decrypt } from '@/lib/encryption'

// Cipher shape is `ivHex:tagHex:dataHex` (three hex groups). A raw base32 TOTP
// secret never contains ':' so we can detect legacy plaintext and pass it
// through, allowing a zero-downtime migration (secrets re-encrypt on next setup).
function looksEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p) && p.length > 0)
}

export function encryptTotpSecret(plaintext: string): string {
  return encrypt(plaintext)
}

export function decryptTotpSecret(stored: string): string {
  return looksEncrypted(stored) ? decrypt(stored) : stored
}
```

- [ ] **Step 4: Use it at the write and read sites**

- `confirmTotpSetup` (`settings/actions.ts:108`): store `totpSecret: encryptTotpSecret(pending)`.
- `verifyCurrentTotp` (`settings/actions.ts:126`): `verifyTOTPCode(decryptTotpSecret(user.totpSecret), cleaned)`.
- `verifyTotp` (`auth/actions.ts`): where it calls `verifyTOTPCode(user.totpSecret, code)`, wrap with `decryptTotpSecret(user.totpSecret)`.

Add imports of `encryptTotpSecret` / `decryptTotpSecret` from `@/lib/totpSecret` in both files.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/lib/totpSecret.test.ts src/test/auth-actions.test.ts`
Expected: PASS. Then `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/totpSecret.ts src/lib/totpSecret.test.ts src/app/app/settings/actions.ts "src/app/[locale]/(auth)/auth/actions.ts"
git commit -m "fix(security): encrypt TOTP secrets at rest (legacy plaintext still readable)"
```

---

## Phase 3 — Low / Hardening

### Task 10: Constant-time CRON_SECRET compare + length guard

**Files:**
- Modify: `src/app/api/cron/credit-reset/route.ts:9-13`
- Test: `src/test/cron-credit-reset.test.ts` (existing 401 test still passes)

- [ ] **Step 1: Implement timing-safe compare**

```ts
// at top of route.ts
import { timingSafeEqual } from 'crypto'

function bearerOk(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header ?? '')
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
```

Replace the guard:

```ts
  if (!bearerOk(req.headers.get('Authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/test/cron-credit-reset.test.ts`
Expected: PASS — set `process.env.CRON_SECRET = 'test-secret'` already satisfies the >=16? No: `'test-secret'` is 11 chars. Update the test's `cronSecret` to a 16+ char value (e.g. `'test-secret-1234567'`) so `bearerOk` accepts it; the 401 tests still pass with wrong/missing headers.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/credit-reset/route.ts src/test/cron-credit-reset.test.ts
git commit -m "fix(security): timing-safe CRON_SECRET compare with length guard"
```

> **Manual follow-up:** Ensure the production `CRON_SECRET` is >= 16 random chars.

---

### Task 11: Reduce account enumeration

**Files:**
- Modify: `src/app/[locale]/(auth)/auth/actions.ts` (`login`) — return generic error
- Modify: `src/app/api/auth/username-available/route.ts` — add IP rate limit
- Test: `src/test/auth-actions.test.ts`

- [ ] **Step 1: Make login non-enumerating**

In `login`, collapse the `emailNotVerified` distinct branch into the generic invalid-credentials response **after** a failed password check path, so an unverified-but-correct password still says `emailNotVerified` only when the password is right. Simplest safe change: only reveal `emailNotVerified` once the password has been verified:

```ts
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return { error: 'auth.errors.invalidCredentials' }
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'auth.errors.invalidCredentials' }
  if (!user.emailVerified) return { error: 'auth.errors.emailNotVerified' }
```

(Keep the existing TOTP/`requiresMfa` flow after this point. Update any test asserting the old ordering.)

- [ ] **Step 2: Throttle username-availability**

```ts
// src/app/api/auth/username-available/route.ts
import { checkIpRateLimit } from '@/lib/auth-rate-limit'
// inside GET, after parsing `raw`, before the DB lookup:
if (!(await checkIpRateLimit('username_check', 30, 60))) {
  return NextResponse.json({ available: false, error: 'rate_limited' })
}
```

- [ ] **Step 3: Run tests + typecheck**

Run: `npx vitest run src/test/auth-actions.test.ts`
Expected: PASS (adjust the MFA-login test if it depended on call ordering). Then `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/(auth)/auth/actions.ts" src/app/api/auth/username-available/route.ts src/test/auth-actions.test.ts
git commit -m "fix(security): reduce account enumeration on login and username check"
```

---

### Task 12: Require REDIS_URL in production (no silent localhost fallback)

**Files:**
- Modify: `src/lib/redis.ts`

- [ ] **Step 1: Fail loudly when REDIS_URL is unset in production**

```ts
// src/lib/redis.ts — before constructing the client
const url = process.env.REDIS_URL
if (!url && process.env.NODE_ENV === 'production') {
  throw new Error('REDIS_URL must be set in production')
}
// ...use `url ?? 'redis://localhost:6379'` for non-production
```

- [ ] **Step 2: Typecheck + run a dependent suite**

Run: `npx tsc --noEmit` and `npx vitest run src/lib/credits.test.ts`
Expected: no new errors; tests pass (they mock redis).

- [ ] **Step 3: Commit**

```bash
git add src/lib/redis.ts
git commit -m "fix(security): require REDIS_URL in production"
```

---

## Final verification

- [ ] Run the whole suite: `npx vitest run` — expect only the pre-existing `gamesFrequency.test.ts` failure (date-dependent, unrelated). All new tests green.
- [ ] `npx tsc --noEmit` — confirm no NEW type errors beyond the ~16 pre-existing test-mock ones.
- [ ] Manual smoke (dev server): register → verify email → login; enable TOTP → logout → login through TOTP challenge; attempt a direct `/api/auth/callback/credentials` POST for a TOTP account and confirm it does NOT create a session; load `/`, `/app`, `/admin` and confirm no CSP breakage.
- [ ] Push to `main` when the user approves (auto-deploys via Coolify).

## Out of scope (tracked, not done here)
- Dedicated `ENCRYPTION_KEY` separate from `NEXTAUTH_SECRET` (needs a re-encryption migration of stored integration secrets).
- Nonce-based strict CSP (remove `'unsafe-inline'`).
- `tokenVersion`/session-revocation on password change (JWT sessions remain valid until expiry).
- Range-request support for hero-media video streaming (performance, not security).
- Explicit `sharp` `limitInputPixels` and per-ticket aggregate attachment quota.
