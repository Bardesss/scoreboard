# Account Display Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each account a first-class `displayName`, editable in settings, used everywhere a user's name is shown — kept one-way in sync with the linked "me-player".

**Architecture:** A new nullable `User.displayName` column (migration backfills it from the me-player's name). A shared `resolveDisplayName()` helper centralizes the precedence. `updateDisplayName` (account settings) writes both `User.displayName` and the linked me-player's `Player.name`; `updatePlayer` is guarded so a linked player can't be renamed independently.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma (PostgreSQL), Vitest, next-intl.

**Spec:** `docs/superpowers/specs/2026-05-20-account-display-name-design.md`

---

## File Structure

**Create:**
- `prisma/migrations/20260520120000_add_user_display_name/migration.sql` — add column + backfill
- `src/lib/displayName.ts` — `resolveDisplayName()`
- `src/lib/displayName.test.ts`
- `src/test/display-name-actions.test.ts` — tests for `updateDisplayName`
- `src/app/app/settings/sections/DisplayNameSection.tsx` — settings editor

**Modify:**
- `prisma/schema.prisma` — `User.displayName`
- `src/app/app/settings/actions.ts` — add `updateDisplayName`
- `src/app/app/players/actions.ts` — `updatePlayer` linked-player guard
- `src/test/players-actions.test.ts` — guard tests
- `src/app/[locale]/(auth)/auth/actions.ts` — `register` writes `displayName`
- `src/app/app/settings/SettingsClient.tsx` + `src/app/app/settings/page.tsx` — wire the new section
- `messages/en/app.json`, `messages/nl/app.json` — `profile.displayName*` keys
- `src/app/app/dashboard/page.tsx` — greeting via resolver
- `src/app/app/profile/page.tsx` + `src/app/app/profile/ProfileClient.tsx` — profile heading
- `src/app/[locale]/u/[username]/page.tsx` + `src/components/social/PublicProfileHero.tsx` — public profile

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260520120000_add_user_display_name/migration.sql`

No unit test — this is a schema change, verified by `prisma generate` succeeding.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, in the `model User { ... }` block, add a line immediately after the existing `username String? @unique` line:

```prisma
  displayName      String?
```

- [ ] **Step 2: Create the migration**

Create the file `prisma/migrations/20260520120000_add_user_display_name/migration.sql` with exactly:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;

-- Backfill: each user's display name = their linked me-player's name, else username.
UPDATE "User"
SET "displayName" = COALESCE(
  (SELECT p."name" FROM "Player" p WHERE p."linkedUserId" = "User"."id" LIMIT 1),
  "username"
)
WHERE "displayName" IS NULL;
```

(Production applies this on container start via the Dockerfile `CMD`'s `prisma migrate deploy`. If you have a local dev database, you may run `npx prisma migrate deploy` to apply it locally — but it is not required for the rest of the plan.)

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: success — the generated client now includes `displayName` on the `User` type. (This needs no database connection.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no NEW errors. (Pre-existing unrelated `src/test/*.test.ts` errors — ignore.) Nothing references `displayName` yet; this just confirms the schema + generated client are valid.

- [ ] **Step 5: Commit**

```
git add prisma/schema.prisma prisma/migrations/20260520120000_add_user_display_name
git commit -m "feat(db): add User.displayName column with backfill migration"
```

---

## Task 2: `resolveDisplayName` helper

**Files:**
- Create: `src/lib/displayName.ts`
- Test: `src/lib/displayName.test.ts`

TDD task.

- [ ] **Step 1: Write the failing test**

Create `src/lib/displayName.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveDisplayName } from './displayName'

describe('resolveDisplayName', () => {
  it('prefers displayName when present', () => {
    expect(resolveDisplayName({ displayName: 'Bartus V.', username: 'bartus', email: 'b@x.com' }))
      .toBe('Bartus V.')
  })

  it('falls back to username when displayName is absent', () => {
    expect(resolveDisplayName({ displayName: null, username: 'bartus', email: 'b@x.com' }))
      .toBe('bartus')
  })

  it('falls back to the email local-part when displayName and username are absent', () => {
    expect(resolveDisplayName({ displayName: null, username: null, email: 'bartus@example.com' }))
      .toBe('bartus')
  })

  it('treats an empty-string displayName as absent', () => {
    expect(resolveDisplayName({ displayName: '', username: 'bartus', email: 'b@x.com' }))
      .toBe('bartus')
  })

  it('returns an empty string when nothing is available', () => {
    expect(resolveDisplayName({})).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/displayName.test.ts`
Expected: FAIL — module `./displayName` does not exist.

- [ ] **Step 3: Implement `src/lib/displayName.ts`**

```ts
/**
 * The name to show for a user, in precedence order:
 * displayName → username → email local-part → empty string.
 * Empty/missing values fall through. Used everywhere a user's name renders.
 */
export function resolveDisplayName(user: {
  displayName?: string | null
  username?: string | null
  email?: string | null
}): string {
  if (user.displayName) return user.displayName
  if (user.username) return user.username
  if (user.email) return user.email.split('@')[0]
  return ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/displayName.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```
git add src/lib/displayName.ts src/lib/displayName.test.ts
git commit -m "feat(lib): add resolveDisplayName helper"
```

---

## Task 3: `updateDisplayName` server action

**Files:**
- Modify: `src/app/app/settings/actions.ts`
- Test: `src/test/display-name-actions.test.ts`

TDD task.

- [ ] **Step 1: Write the failing test**

Create `src/test/display-name-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: vi.fn() },
    player: { updateMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { updateDisplayName } from '@/app/app/settings/actions'

const session = { user: { id: 'user-1', email: 'me@example.com', locale: 'en', role: 'user' } }

function form(displayName: string): FormData {
  const fd = new FormData()
  fd.set('displayName', displayName)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(prisma.user.update).mockResolvedValue({} as never)
  vi.mocked(prisma.player.updateMany).mockResolvedValue({ count: 1 } as never)
})

describe('updateDisplayName', () => {
  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    expect(await updateDisplayName(form('Bartus'))).toEqual({ success: false, error: 'unauthorized' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects an empty (whitespace-only) display name', async () => {
    expect(await updateDisplayName(form('   '))).toEqual({ success: false, error: 'display_name_invalid' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects a display name longer than 40 characters', async () => {
    expect(await updateDisplayName(form('x'.repeat(41)))).toEqual({ success: false, error: 'display_name_invalid' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('writes the trimmed name to the user and the linked me-player', async () => {
    const result = await updateDisplayName(form('  Bartus V.  '))
    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { displayName: 'Bartus V.' },
    })
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { linkedUserId: 'user-1' },
      data: { name: 'Bartus V.' },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/display-name-actions.test.ts`
Expected: FAIL — `updateDisplayName` is not exported from `@/app/app/settings/actions`.

- [ ] **Step 3: Implement `updateDisplayName`**

In `src/app/app/settings/actions.ts`, append this function at the end of the file. It reuses the file's existing `Result` type (the same type `updateUsername` returns) and the already-imported `auth`, `prisma`, and `revalidatePath`:

```ts
export async function updateDisplayName(formData: FormData): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }

  const raw = formData.get('displayName')
  const displayName = typeof raw === 'string' ? raw.trim() : ''
  if (displayName.length < 1 || displayName.length > 40) {
    return { success: false, error: 'display_name_invalid' }
  }

  // displayName is the source of truth; the linked me-player's name follows it
  // (one-way). avatarSeed is intentionally left untouched — a name edit should
  // not reroll the avatar. updateMany is a no-op when the user has no me-player.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { displayName },
  })
  await prisma.player.updateMany({
    where: { linkedUserId: session.user.id },
    data: { name: displayName },
  })

  revalidatePath('/app/settings')
  revalidatePath('/app/profile')
  revalidatePath('/app/dashboard')
  return { success: true }
}
```

If `tsc` reports the `Result` type name is different in this file, use whatever the file's shared result type for `updateUsername` is — the return shapes `{ success: true }` and `{ success: false, error: string }` are what matters.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/display-name-actions.test.ts`
Expected: PASS — 4 tests.

Also run `npx tsc --noEmit` — no new errors in `actions.ts` / the new test file.

- [ ] **Step 5: Commit**

```
git add src/app/app/settings/actions.ts src/test/display-name-actions.test.ts
git commit -m "feat(settings): add updateDisplayName action with me-player sync"
```

---

## Task 4: `updatePlayer` linked-player guard

**Files:**
- Modify: `src/app/app/players/actions.ts`
- Test: `src/test/players-actions.test.ts`

TDD task.

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to the end of `src/test/players-actions.test.ts`. (The file already mocks `@/lib/prisma` with `prisma.player.{findUnique,update,...}`, `@/lib/auth`, `next/cache`, `next/navigation`, and defines `session` with `user.id === 'user-1'`.)

```ts
describe('updatePlayer — linked-player name guard', () => {
  beforeEach(() => vi.clearAllMocks())

  function nameForm(name: string): FormData {
    const fd = new FormData()
    fd.set('name', name)
    fd.set('color', '#f5a623')
    return fd
  }

  it('rejects a name change on a player linked to an account', async () => {
    vi.mocked(auth).mockResolvedValue(session as never)
    vi.mocked(prisma.player.findUnique).mockResolvedValue({
      id: 'p1', userId: 'user-1', linkedUserId: 'someone-else', name: 'Old', avatarSeed: 'old', color: '#fff',
    } as never)

    const result = await updatePlayer('p1', nameForm('New'))
    expect(result).toEqual({ success: false, error: 'linked_player_name' })
    expect(prisma.player.update).not.toHaveBeenCalled()
  })

  it('allows a color-only edit on a linked player (name unchanged)', async () => {
    vi.mocked(auth).mockResolvedValue(session as never)
    vi.mocked(prisma.player.findUnique).mockResolvedValue({
      id: 'p1', userId: 'user-1', linkedUserId: 'someone-else', name: 'Old', avatarSeed: 'old', color: '#fff',
    } as never)
    vi.mocked(prisma.player.update).mockResolvedValue({} as never)

    const result = await updatePlayer('p1', nameForm('Old'))
    expect(result).toEqual({ success: true })
    expect(prisma.player.update).toHaveBeenCalled()
  })

  it('allows renaming an unlinked player', async () => {
    vi.mocked(auth).mockResolvedValue(session as never)
    vi.mocked(prisma.player.findUnique).mockResolvedValue({
      id: 'p2', userId: 'user-1', linkedUserId: null, name: 'Old', avatarSeed: 'old', color: '#fff',
    } as never)
    vi.mocked(prisma.player.update).mockResolvedValue({} as never)

    const result = await updatePlayer('p2', nameForm('New'))
    expect(result).toEqual({ success: true })
    expect(prisma.player.update).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/players-actions.test.ts`
Expected: FAIL — the first test fails (no guard yet, so a linked player's name change is allowed and `update` is called).

- [ ] **Step 3: Add the guard**

In `src/app/app/players/actions.ts`, in `updatePlayer`, the current code after the ownership check is:

```ts
  const player = await prisma.player.findUnique({ where: { id } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'notFound' }

  await prisma.player.update({
```

Insert the guard between the ownership check and the `update` call:

```ts
  const player = await prisma.player.findUnique({ where: { id } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'notFound' }

  // A player linked to a real account has its name governed by that account's
  // display name (account settings → updateDisplayName). Block name changes
  // here; color/avatar edits stay allowed.
  if (player.linkedUserId !== null && name !== player.name) {
    return { success: false, error: 'linked_player_name' }
  }

  await prisma.player.update({
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/players-actions.test.ts`
Expected: PASS — all tests in the file, including the 3 new ones.

Also run `npx tsc --noEmit` — no new errors.

- [ ] **Step 5: Commit**

```
git add src/app/app/players/actions.ts src/test/players-actions.test.ts
git commit -m "feat(players): block name changes on account-linked players"
```

---

## Task 5: Registration writes `displayName`

**Files:**
- Modify: `src/app/[locale]/(auth)/auth/actions.ts`

The codebase has no register success-path test (the existing `auth-actions.test.ts` register tests only cover error paths), so this one-field addition is verified by those tests still passing + type-check.

- [ ] **Step 1: Write `displayName` on the user row**

In `src/app/[locale]/(auth)/auth/actions.ts`, in the `register` function, the `prisma.user.create` call currently is:

```ts
  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      locale,
      emailVerified: await isMailConfigured() ? null : new Date(),
    },
  })
```

Change the `data` to also set `displayName` from the already-parsed `name` field:

```ts
  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName: name,
      passwordHash,
      locale,
      emailVerified: await isMailConfigured() ? null : new Date(),
    },
  })
```

The `prisma.player.create` call below it (which creates the me-player with `name`) stays exactly as is.

- [ ] **Step 2: Verify existing tests still pass + type-check**

Run: `npx vitest run src/test/auth-actions.test.ts`
Expected: PASS — all existing register error-path tests unaffected.

Run: `npx tsc --noEmit`
Expected: no new errors in `actions.ts`.

- [ ] **Step 3: Commit**

```
git add "src/app/[locale]/(auth)/auth/actions.ts"
git commit -m "feat(auth): registration sets User.displayName"
```

---

## Task 6: Settings UI — Display name editor

**Files:**
- Create: `src/app/app/settings/sections/DisplayNameSection.tsx`
- Modify: `messages/en/app.json`, `messages/nl/app.json`
- Modify: `src/app/app/settings/SettingsClient.tsx`, `src/app/app/settings/page.tsx`

No React render tests in this codebase — verified by type-check + manual check.

- [ ] **Step 1: Add translation keys**

In `messages/en/app.json`, find the `"profile"` object (it contains `"username"`, `"usernameSaved"`, `"usernameHint"`). Add these three key/value pairs inside that object:

```json
    "displayName": "Display name",
    "displayNameSaved": "Display name saved",
    "displayNameHint": "Shown across Dice Vault — on your dashboard, profile, and to other players.",
```

In `messages/nl/app.json`, find the same `"profile"` object and add:

```json
    "displayName": "Weergavenaam",
    "displayNameSaved": "Weergavenaam opgeslagen",
    "displayNameHint": "Wordt overal in Dice Vault getoond — op je dashboard, profiel en bij andere spelers.",
```

(Ensure valid JSON — correct commas around the inserted lines.)

- [ ] **Step 2: Create the `DisplayNameSection` component**

Create `src/app/app/settings/sections/DisplayNameSection.tsx` — mirrors the existing `UsernameSection`:

```tsx
'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { updateDisplayName } from '../actions'

type Props = {
  initial: string | null
}

export function DisplayNameSection({ initial }: Props) {
  const t = useTranslations('app.profile')
  const [state, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => updateDisplayName(formData),
    null,
  )

  return (
    <section style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 16, color: '#1e1a14', marginBottom: 12 }}>
        {t('displayName')}
      </h2>
      <form action={formAction} className="flex gap-2">
        <input
          name="displayName"
          defaultValue={initial ?? ''}
          maxLength={40}
          className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm outline-none"
          style={{ background: '#f5f0e8', border: '1px solid #e8e1d8', color: '#1e1a14' }}
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          {pending ? '…' : t('save')}
        </button>
      </form>
      {state && 'success' in state && state.success && (
        <p className="mt-2 font-body text-xs" style={{ color: '#16a34a' }}>{t('displayNameSaved')}</p>
      )}
      {state && 'success' in state && !state.success && (
        <p className="mt-2 font-body text-xs" style={{ color: '#dc2626' }}>{state.error}</p>
      )}
      <p className="mt-2 font-body text-xs" style={{ color: '#9a8878' }}>{t('displayNameHint')}</p>
    </section>
  )
}
```

- [ ] **Step 3: Wire it into `SettingsClient`**

In `src/app/app/settings/SettingsClient.tsx`:

(a) Add the import next to the other section imports:

```ts
import { DisplayNameSection } from './sections/DisplayNameSection'
```

(b) The component's props type currently has `username: string | null`. Add a `displayName` field beside it:

```ts
  displayName: string | null
```

(c) Add `displayName` to the destructured props (the function signature destructures `username` among others — add `displayName` there too).

(d) In the JSX, the sections are rendered starting with `<UsernameSection initial={username} />`. Add the new section immediately before it:

```tsx
        <DisplayNameSection initial={displayName} />
        <UsernameSection initial={username} />
```

- [ ] **Step 4: Wire it into the settings page**

In `src/app/app/settings/page.tsx`:

(a) Add `displayName: true` to the `select` in the `prisma.user.findUnique` call (next to `username: true`).

(b) Pass it to `<SettingsClient>` — add this prop next to `username={user.username}`:

```tsx
        displayName={user.displayName}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in any of the touched files.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, sign in, open `/app/settings`. A "Display name" editor appears above the username editor. Saving a new value shows the success message; reloading shows the saved value.

- [ ] **Step 7: Commit**

```
git add src/app/app/settings/sections/DisplayNameSection.tsx src/app/app/settings/SettingsClient.tsx src/app/app/settings/page.tsx messages/en/app.json messages/nl/app.json
git commit -m "feat(settings): Display name editor section"
```

---

## Task 7: Site-wide adoption

**Files:**
- Modify: `src/app/app/dashboard/page.tsx`
- Modify: `src/app/app/profile/page.tsx`, `src/app/app/profile/ProfileClient.tsx`
- Modify: `src/app/[locale]/u/[username]/page.tsx`, `src/components/social/PublicProfileHero.tsx`

Verified by type-check + manual check.

- [ ] **Step 1: Dashboard greeting**

In `src/app/app/dashboard/page.tsx`:

(a) Add the import:

```ts
import { resolveDisplayName } from '@/lib/displayName'
```

(b) The `Promise.all` currently selects `user` and a separate `mePlayer`, then computes the greeting from `mePlayer`. Replace the user select to include `displayName`, and **remove the now-unused `mePlayer` query**. The block currently reads:

```ts
  const [stats, gamesPage, user, mePlayer, i18n, tDashboard] = await Promise.all([
    loadStats(scope, filter, locale),
    loadGames(scope, filter, page, 25, 'compact'),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true, email: true } }),
    prisma.player.findFirst({ where: { linkedUserId: session.user.id }, select: { name: true } }),
    buildStatsLabels(locale),
    getTranslations({ locale, namespace: 'app.dashboard' }),
  ])
  const { labels, formatters } = i18n

  // Greeting prefers the "me" player's name (e99f961), then username (b820d3f), then email local-part.
  const displayName = mePlayer?.name ?? user?.username ?? user?.email?.split('@')[0] ?? ''
```

Replace that whole block with:

```ts
  const [stats, gamesPage, user, i18n, tDashboard] = await Promise.all([
    loadStats(scope, filter, locale),
    loadGames(scope, filter, page, 25, 'compact'),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { displayName: true, username: true, email: true },
    }),
    buildStatsLabels(locale),
    getTranslations({ locale, namespace: 'app.dashboard' }),
  ])
  const { labels, formatters } = i18n

  const displayName = resolveDisplayName(user ?? {})
```

- [ ] **Step 2: Profile page**

In `src/app/app/profile/page.tsx`:

(a) Add `displayName: true` to the `select` of the `prisma.user.findUnique` call (next to `username: true`).

(b) Pass it to `<ProfileClient>` — add this prop next to `username={user.username}`:

```tsx
      displayName={user.displayName}
```

- [ ] **Step 3: ProfileClient**

In `src/app/app/profile/ProfileClient.tsx`:

(a) Add the import:

```ts
import { resolveDisplayName } from '@/lib/displayName'
```

(b) In the `Props` type, add a field beside `username`:

```ts
  displayName: string | null
```

(c) Replace the line `const displayName = props.username ?? props.email` with:

```ts
  const displayName = resolveDisplayName(props)
```

- [ ] **Step 4: Public profile data**

In `src/app/[locale]/u/[username]/page.tsx`:

(a) Add `displayName: true` to the `select` in the `prisma.user.findUnique` that loads `profile` (next to `username: true`).

(b) Pass it to `<PublicProfileHero>` — add this prop:

```tsx
        displayName={profile.displayName}
```

- [ ] **Step 5: PublicProfileHero**

In `src/components/social/PublicProfileHero.tsx`, the heading and avatar currently render `username`, with `@{username}` in the subline. Render the display name as the heading instead, keeping `@{username}` as the handle.

(a) Add `displayName: string | null` to the `Props` type.

(b) Add it to the destructured parameters: `{ displayName, username, avatarSeed: _avatarSeed, gamesCount, winsCount, winRate }`.

(c) Add, at the top of the function body (before the `return`):

```tsx
  const name = displayName || username
```

(d) Change the avatar initial from `{username.charAt(0).toUpperCase()}` to `{name.charAt(0).toUpperCase()}`.

(e) Change the `<h1>` content from `{username}` to `{name}`.

(f) Leave the subline `@{username} · {gamesCount} games · ...` exactly as it is.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in any touched file. (If `tsc` reports `mePlayer` is unused or `prisma`/`getTranslations` import issues in `dashboard/page.tsx`, recheck Step 1 — the `mePlayer` destructuring entry must be removed.)

- [ ] **Step 7: Manual verification**

Run `npm run dev`. Set a Display name in `/app/settings`, then confirm it appears in: the dashboard greeting, the `/app/profile` heading, and your public profile `/u/<username>` heading (with `@username` still shown as the handle).

- [ ] **Step 8: Commit**

```
git add src/app/app/dashboard/page.tsx src/app/app/profile/page.tsx src/app/app/profile/ProfileClient.tsx "src/app/[locale]/u/[username]/page.tsx" src/components/social/PublicProfileHero.tsx
git commit -m "feat(ui): use account display name on dashboard, profile and public profile"
```

---

## Out of scope (noted, not done here)

Other users' names in **list contexts** — the connections list on `/app/profile`, and the
connection display in the Players UI — still render `username`. Routing those through
`resolveDisplayName` needs `displayName` added to several relational Prisma selects; it is
a bounded follow-up. The resolver is ready for it. Not part of this plan.

---

## Final Verification

- [ ] **Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `displayName.test.ts`, `display-name-actions.test.ts`, and the added `players-actions.test.ts` cases.

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors in any file this plan created or modified.
