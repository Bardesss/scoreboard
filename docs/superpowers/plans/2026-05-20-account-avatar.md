# Account Avatar (Colour + Pictogram) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user pick a colour + pictogram for their account avatar, shown everywhere they appear, kept one-way in sync with their linked me-player.

**Architecture:** New nullable `User.avatarColor`/`avatarIcon` columns and a `Player.icon` column. The shared `Avatar` component gains optional `color`/`icon` props (emoji-on-colour when `icon` set, else current initials behaviour). An account-settings picker writes the `User` fields and syncs the me-player. The me-player's `color`/`icon` are threaded through the stats pipeline so the avatar renders in standings/dashboard.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma (PostgreSQL), Vitest, next-intl, sonner.

**Spec:** `docs/superpowers/specs/2026-05-20-account-avatar-design.md`

---

## File Structure

**Create:**
- `prisma/migrations/20260520140000_add_account_avatar/migration.sql`
- `src/lib/avatarOptions.ts` — `AVATAR_COLORS`, `AVATAR_ICONS`
- `src/app/app/settings/sections/AvatarSection.tsx` — settings picker
- `src/test/avatar-actions.test.ts` — tests for `updateAvatar` / `removeAvatar`

**Modify:**
- `prisma/schema.prisma` — `User.avatarColor`, `User.avatarIcon`, `Player.icon`
- `src/components/shared/Avatar.tsx` — optional `color`/`icon` props
- `src/app/app/settings/actions.ts` — `updateAvatar`, `removeAvatar`
- `src/app/app/settings/SettingsClient.tsx` + `src/app/app/settings/page.tsx` — wire `AvatarSection`
- `messages/en/app.json`, `messages/nl/app.json` — `profile.avatar*` keys
- `src/lib/stats/types.ts` — `color?`/`icon?` on 7 types
- `src/lib/stats/loadStats.ts` — 2 player `select` blocks
- `src/lib/stats/{ranking,headToHead,recentForm,streaks,totalPoints}.ts` — copy `color`/`icon` into entries
- `src/components/stats/HeadToHeadGrid.tsx`, `src/app/app/dashboard/DashboardClient.tsx`, `src/app/app/leagues/[id]/LeagueStatsClient.tsx`, `src/app/app/players/PlayersClient.tsx` — pass `color`/`icon` to `<Avatar>`
- `src/app/api/app/players/route.ts`, `src/app/app/players/page.tsx` — select `icon`
- `src/app/app/profile/ProfileClient.tsx` + `src/app/app/profile/page.tsx` — profile-header avatar
- `src/components/social/PublicProfileHero.tsx` + `src/app/[locale]/u/[username]/page.tsx` — public-profile avatar

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260520140000_add_account_avatar/migration.sql`

No unit test — schema change, verified by `prisma generate`.

- [ ] **Step 1: Add columns to the schema**

In `prisma/schema.prisma`:
- In `model User`, add after the existing `displayName String?` line:
  ```prisma
  avatarColor      String?
  avatarIcon       String?
  ```
- In `model Player`, add after the existing `color String @default("#f5a623")` line:
  ```prisma
  icon          String?
  ```

- [ ] **Step 2: Create the migration**

Create `prisma/migrations/20260520140000_add_account_avatar/migration.sql` with exactly:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarColor" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarIcon" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "icon" TEXT;
```

No backfill — every account/player starts uncustomised (null).

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: success — the generated client now has `avatarColor`/`avatarIcon` on `User` and `icon` on `Player`. (No database connection needed. Do NOT run `prisma migrate dev`.)

- [ ] **Step 4: Fix any test mocks the new columns break**

Run: `npx tsc --noEmit`. The project has MANY pre-existing unrelated `tsc` errors — ignore everything that does NOT mention `avatarColor`, `avatarIcon`, or `icon`. Adding fields to the `User` type can make a test-file mock object typed as a full `User` incomplete (this happened for an earlier `displayName` migration in `src/test/auth-actions.test.ts`).

For every error reported as `avatarColor`/`avatarIcon` missing from an object literal: add `avatarColor: null` and `avatarIcon: null` to that mock object (right after its `displayName` field). Do NOT change test logic. Re-run `npx tsc --noEmit` and confirm no remaining errors mention `avatarColor`/`avatarIcon`/`icon`.

- [ ] **Step 5: Commit**

```
git add prisma/schema.prisma prisma/migrations/20260520140000_add_account_avatar src/test
git commit -m "feat(db): add account avatar columns (User.avatarColor/avatarIcon, Player.icon)"
```

---

## Task 2: Avatar options constants

**Files:**
- Create: `src/lib/avatarOptions.ts`

No unit test — this is a data module, consumed (and validated against) by later tasks.

- [ ] **Step 1: Create `src/lib/avatarOptions.ts`**

```ts
/**
 * The fixed sets a user can pick from for their account avatar. Both the picker
 * UI and the updateAvatar server action validate against these — single source
 * of truth for the allowed values.
 */
export const AVATAR_COLORS: string[] = [
  '#f5a623', '#e85d26', '#dc2626', '#db2777', '#7c3aed',
  '#2563eb', '#0891b2', '#16a34a', '#65a30d', '#ca8a04',
  '#78716c', '#0f172a',
]

export const AVATAR_ICONS: string[] = [
  '😀', '😎', '🤓', '🥳', '🦊', '🐱', '🐶', '🐼',
  '🦁', '🐸', '🐧', '🦉', '🐙', '🦄', '🐢', '🐝',
  '⭐', '⚡', '🔥', '🌈', '🍀', '🎈', '🚀', '🎸',
  '⚽', '🎲', '👑', '💎',
]
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `avatarOptions.ts` (pre-existing unrelated test-file errors — ignore).

- [ ] **Step 3: Commit**

```
git add src/lib/avatarOptions.ts
git commit -m "feat(lib): add avatar colour + pictogram option lists"
```

---

## Task 3: Extend the `Avatar` component

**Files:**
- Modify: `src/components/shared/Avatar.tsx`

No render tests in this codebase — verified by type-check. The new props are OPTIONAL, so every existing `<Avatar seed name />` call site keeps compiling unchanged.

- [ ] **Step 1: Replace the component**

Replace the entire contents of `src/components/shared/Avatar.tsx` with:

```tsx
const COLORS = ['#f5a623', '#e85d26', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#0891b2']

function hashColor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

/**
 * Renders a user/player avatar. When `icon` is set, shows that pictogram on the
 * `color` background (the customised account avatar). Otherwise falls back to
 * the initials on a seed-hashed colour.
 */
export function Avatar({
  seed,
  name,
  size = 36,
  color,
  icon,
}: {
  seed: string
  name: string
  size?: number
  color?: string | null
  icon?: string | null
}) {
  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  if (icon) {
    return (
      <div style={{ ...box, background: color || hashColor(seed) }}>
        <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>{icon}</span>
      </div>
    )
  }

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'

  return (
    <div style={{ ...box, background: hashColor(seed) }}>
      <span
        style={{
          color: '#fff',
          fontWeight: 700,
          fontSize: size * 0.36,
          fontFamily: 'var(--font-headline)',
          letterSpacing: '-0.01em',
        }}
      >
        {initials}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `Avatar.tsx` and no NEW errors at any existing `<Avatar>` call site (the added props are optional). Pre-existing unrelated test-file errors — ignore.

- [ ] **Step 3: Commit**

```
git add src/components/shared/Avatar.tsx
git commit -m "feat(ui): Avatar supports a chosen colour + pictogram"
```

---

## Task 4: `updateAvatar` / `removeAvatar` server actions

**Files:**
- Modify: `src/app/app/settings/actions.ts`
- Test: `src/test/avatar-actions.test.ts` (create)

TDD task.

- [ ] **Step 1: Write the failing test**

Create `src/test/avatar-actions.test.ts`:

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
import { AVATAR_COLORS, AVATAR_ICONS } from '@/lib/avatarOptions'
import { updateAvatar, removeAvatar } from '@/app/app/settings/actions'

const session = { user: { id: 'user-1', email: 'me@example.com', locale: 'en', role: 'user' } }
const validColor = AVATAR_COLORS[0]
const validIcon = AVATAR_ICONS[0]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(prisma.user.update).mockResolvedValue({} as never)
  vi.mocked(prisma.player.updateMany).mockResolvedValue({ count: 1 } as never)
})

describe('updateAvatar', () => {
  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    expect(await updateAvatar(validColor, validIcon)).toEqual({ success: false, error: 'unauthorized' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects a colour not in the allowed list', async () => {
    expect(await updateAvatar('#123456', validIcon)).toEqual({ success: false, error: 'invalid' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects an icon not in the allowed list', async () => {
    expect(await updateAvatar(validColor, 'X')).toEqual({ success: false, error: 'invalid' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('writes the avatar to the user and syncs the me-player', async () => {
    const result = await updateAvatar(validColor, validIcon)
    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarColor: validColor, avatarIcon: validIcon },
    })
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { linkedUserId: 'user-1' },
      data: { color: validColor, icon: validIcon },
    })
  })
})

describe('removeAvatar', () => {
  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    expect(await removeAvatar()).toEqual({ success: false, error: 'unauthorized' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('clears the user avatar and the me-player icon', async () => {
    const result = await removeAvatar()
    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarColor: null, avatarIcon: null },
    })
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { linkedUserId: 'user-1' },
      data: { icon: null },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/avatar-actions.test.ts`
Expected: FAIL — `updateAvatar` / `removeAvatar` are not exported from `@/app/app/settings/actions`.

- [ ] **Step 3: Implement the actions**

Append to the END of `src/app/app/settings/actions.ts`. Reuse the file's existing `Result` type (the type `updateUsername`/`updateDisplayName` return) and the already-imported `auth`, `prisma`, `revalidatePath`. Add an import for the option lists at the top of the file, matching the file's import style:

```ts
import { AVATAR_COLORS, AVATAR_ICONS } from '@/lib/avatarOptions'
```

Appended functions:

```ts
export async function updateAvatar(color: string, icon: string): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }

  if (!AVATAR_COLORS.includes(color) || !AVATAR_ICONS.includes(icon)) {
    return { success: false, error: 'invalid' }
  }

  // User fields are the source of truth; the linked me-player follows them
  // one-way. updateMany is a no-op when the user has no me-player.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarColor: color, avatarIcon: icon },
  })
  await prisma.player.updateMany({
    where: { linkedUserId: session.user.id },
    data: { color, icon },
  })

  revalidatePath('/app/settings')
  revalidatePath('/app/profile')
  revalidatePath('/app/dashboard')
  return { success: true }
}

export async function removeAvatar(): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarColor: null, avatarIcon: null },
  })
  // Clear only the me-player's icon — Player.color is non-null; Avatar ignores
  // it once icon is null, so leaving it is harmless.
  await prisma.player.updateMany({
    where: { linkedUserId: session.user.id },
    data: { icon: null },
  })

  revalidatePath('/app/settings')
  revalidatePath('/app/profile')
  revalidatePath('/app/dashboard')
  return { success: true }
}
```

If the file's result type is not named `Result`, use the actual name — the shapes `{ success: true }` / `{ success: false, error: string }` are what matter.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/avatar-actions.test.ts`
Expected: PASS — 6 tests.

Also run `npx tsc --noEmit` — no new errors in `actions.ts` / the new test file.

- [ ] **Step 5: Commit**

```
git add src/app/app/settings/actions.ts src/test/avatar-actions.test.ts
git commit -m "feat(settings): add updateAvatar/removeAvatar actions with me-player sync"
```

---

## Task 5: Settings UI — Avatar picker

**Files:**
- Create: `src/app/app/settings/sections/AvatarSection.tsx`
- Modify: `messages/en/app.json`, `messages/nl/app.json`
- Modify: `src/app/app/settings/SettingsClient.tsx`, `src/app/app/settings/page.tsx`

No render tests — verified by type-check + manual check.

- [ ] **Step 1: Add translation keys**

In `messages/en/app.json`, find the `"profile"` object (it contains `"displayName"`, `"username"`, `"save"`, …). Add inside it:

```json
    "avatar": "Avatar",
    "avatarHint": "Pick a colour and a pictogram. Shown across Dice Vault wherever you appear.",
    "avatarColorLabel": "Colour",
    "avatarIconLabel": "Pictogram",
    "avatarRemove": "Remove custom avatar",
    "avatarSaved": "Avatar saved",
    "avatarRemoved": "Avatar removed",
    "avatarError": "Something went wrong. Please try again.",
```

In `messages/nl/app.json`, in the same `"profile"` object, add:

```json
    "avatar": "Avatar",
    "avatarHint": "Kies een kleur en een pictogram. Wordt overal in Dice Vault getoond waar jij verschijnt.",
    "avatarColorLabel": "Kleur",
    "avatarIconLabel": "Pictogram",
    "avatarRemove": "Eigen avatar verwijderen",
    "avatarSaved": "Avatar opgeslagen",
    "avatarRemoved": "Avatar verwijderd",
    "avatarError": "Er ging iets mis. Probeer het opnieuw.",
```

Ensure valid JSON (comma placement).

- [ ] **Step 2: Create `AvatarSection`**

Create `src/app/app/settings/sections/AvatarSection.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AVATAR_COLORS, AVATAR_ICONS } from '@/lib/avatarOptions'
import { updateAvatar, removeAvatar } from '../actions'

type Props = {
  initialColor: string | null
  initialIcon: string | null
}

export function AvatarSection({ initialColor, initialIcon }: Props) {
  const t = useTranslations('app.profile')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [color, setColor] = useState<string>(initialColor ?? AVATAR_COLORS[0])
  const [icon, setIcon] = useState<string>(initialIcon ?? AVATAR_ICONS[0])

  const hasCustom = initialIcon !== null

  function onSave() {
    startTransition(async () => {
      const res = await updateAvatar(color, icon)
      if (res.success) {
        toast.success(t('avatarSaved'))
        router.refresh()
      } else {
        toast.error(t('avatarError'))
      }
    })
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeAvatar()
      if (res.success) {
        toast.success(t('avatarRemoved'))
        router.refresh()
      } else {
        toast.error(t('avatarError'))
      }
    })
  }

  return (
    <section style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 16, color: '#1e1a14', marginBottom: 4 }}>
        {t('avatar')}
      </h2>
      <p className="font-body text-xs" style={{ color: '#9a8878', marginBottom: 14 }}>{t('avatarHint')}</p>

      {/* Preview */}
      <div
        style={{
          width: 56, height: 56, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, lineHeight: 1, marginBottom: 14,
        }}
      >
        {icon}
      </div>

      {/* Colour picker */}
      <p className="font-headline font-bold text-xs" style={{ color: '#4a3f2f', marginBottom: 8 }}>
        {t('avatarColorLabel')}
      </p>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 14 }}>
        {AVATAR_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="w-7 h-7 rounded-full transition-transform"
            style={{
              background: c,
              outlineOffset: 2,
              boxShadow: color === c ? '0 0 0 1px #fff, 0 0 0 3px ' + c : 'none',
              transform: color === c ? 'scale(1.2)' : 'scale(1)',
            }}
            aria-label={c}
          />
        ))}
      </div>

      {/* Icon picker */}
      <p className="font-headline font-bold text-xs" style={{ color: '#4a3f2f', marginBottom: 8 }}>
        {t('avatarIconLabel')}
      </p>
      <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 16 }}>
        {AVATAR_ICONS.map(ic => (
          <button
            key={ic}
            type="button"
            onClick={() => setIcon(ic)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
            style={{
              background: icon === ic ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: icon === ic ? '1.5px solid #f5a623' : '1.5px solid transparent',
            }}
          >
            {ic}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408', opacity: pending ? 0.6 : 1 }}
        >
          {pending ? '…' : t('save')}
        </button>
        {hasCustom && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', opacity: pending ? 0.6 : 1 }}
          >
            {t('avatarRemove')}
          </button>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Wire into `SettingsClient`**

In `src/app/app/settings/SettingsClient.tsx`:

(a) Add the import beside the other section imports:
```ts
import { AvatarSection } from './sections/AvatarSection'
```
(b) Add two fields to the props type, beside `displayName: string | null`:
```ts
  avatarColor: string | null
  avatarIcon: string | null
```
(c) Add `avatarColor` and `avatarIcon` to the destructured props parameter.
(d) In the JSX, the sections render with `<DisplayNameSection initial={displayName} />` near the top. Add the avatar section immediately before `<DisplayNameSection ... />`:
```tsx
        <AvatarSection initialColor={avatarColor} initialIcon={avatarIcon} />
        <DisplayNameSection initial={displayName} />
```

- [ ] **Step 4: Wire into the settings page**

In `src/app/app/settings/page.tsx`:
(a) Add `avatarColor: true` and `avatarIcon: true` to the `prisma.user.findUnique` `select` (next to `displayName: true`).
(b) Pass them to `<SettingsClient>` (next to `displayName={user.displayName}`):
```tsx
        avatarColor={user.avatarColor}
        avatarIcon={user.avatarIcon}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the touched `.tsx` files. Pre-existing unrelated test-file errors — ignore.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, sign in, open `/app/settings`. An "Avatar" section appears with a colour row, a pictogram grid, and a live preview. Saving shows a success toast; the preview persists after reload. "Remove custom avatar" appears once one is set and reverts to no custom avatar.

- [ ] **Step 7: Commit**

```
git add src/app/app/settings/sections/AvatarSection.tsx src/app/app/settings/SettingsClient.tsx src/app/app/settings/page.tsx messages/en/app.json messages/nl/app.json
git commit -m "feat(settings): account avatar picker section"
```

---

## Task 6: Thread `color`/`icon` through the stats pipeline

**Files:**
- Modify: `src/lib/stats/types.ts`
- Modify: `src/lib/stats/loadStats.ts`
- Modify: `src/lib/stats/ranking.ts`, `headToHead.ts`, `recentForm.ts`, `streaks.ts`, `totalPoints.ts`

The new fields are added as **optional** (`color?`, `icon?`) so the existing `src/lib/stats/*.test.ts` fixtures and `toEqual` assertions are unaffected. Verified by `npx vitest run src/lib/stats` staying green + type-check.

- [ ] **Step 1: Add optional fields to the stats types**

In `src/lib/stats/types.ts`, each of these types has a line `avatarSeed: string`. Immediately after that line in EACH of them, add:

```ts
  color?: string
  icon?: string | null
```

The types to update (each has exactly one `avatarSeed: string` to anchor on):
- `RankingEntry`
- `HeadToHeadMatrix` — the player object inside its `players` array
- `StreakEntry`
- `RecentFormRow`
- `TotalPointsEntry`
- `AggregatorGame` — the `player` object inside `scores[]`
- `AggregatorMember` — the `player` object

(7 insertions total, all identical.)

- [ ] **Step 2: Select the fields in `loadStats.ts`**

In `src/lib/stats/loadStats.ts` there are two `player: { select: { id: true, name: true, avatarSeed: true, linkedUserId: true } }` blocks (one inside the `playedGame.findMany` scores include, one inside the `leagueMember.findMany` include). In BOTH, add `color: true, icon: true`:

```ts
player: { select: { id: true, name: true, avatarSeed: true, linkedUserId: true, color: true, icon: true } }
```

- [ ] **Step 3: Copy the fields into aggregator output entries**

In each of the five aggregators below, find every place an output entry object is built carrying `avatarSeed` (copied from a source player), and add `color` and `icon` copied from the same source player — exactly mirroring how `avatarSeed` is copied. The source player objects now carry `color`/`icon` (Step 1/2).

- `src/lib/stats/ranking.ts` — `RankingEntry` construction.
- `src/lib/stats/headToHead.ts` — the `players` array items of the matrix.
- `src/lib/stats/recentForm.ts` — `RecentFormRow` construction.
- `src/lib/stats/streaks.ts` — `StreakEntry` construction.
- `src/lib/stats/totalPoints.ts` — `TotalPointsEntry` construction.

Concretely: wherever an entry literal contains `avatarSeed: <player>.avatarSeed`, add `color: <player>.color` and `icon: <player>.icon` next to it (same `<player>` reference). If an aggregator captures the player identity once into a local/map and reuses it, add `color`/`icon` to that captured shape too.

`winTrend.ts` is intentionally NOT changed — it uses its own chart-line palette and does not render an `<Avatar>`.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/stats`
Expected: PASS — all existing stats tests still pass (the optional fields and `toEqual`'s tolerance of `undefined` extras mean fixtures need no change).

Run: `npx tsc --noEmit`
Expected: no new errors in the touched files.

- [ ] **Step 5: Commit**

```
git add src/lib/stats
git commit -m "feat(stats): carry player avatar colour/icon through the stats pipeline"
```

---

## Task 7: Pass `color`/`icon` to `<Avatar>` at every player render site

**Files:**
- Modify: `src/components/stats/HeadToHeadGrid.tsx`
- Modify: `src/app/app/dashboard/DashboardClient.tsx`
- Modify: `src/app/app/leagues/[id]/LeagueStatsClient.tsx`
- Modify: `src/app/app/players/PlayersClient.tsx`
- Modify: `src/app/api/app/players/route.ts`, `src/app/app/players/page.tsx`

Verified by type-check + manual check.

- [ ] **Step 1: Stats `<Avatar>` call sites**

In each of these files, every `<Avatar>` usage currently passes `seed={X.avatarSeed} name={X.name}`. Add `color={X.color}` and `icon={X.icon}` to each (same `X` reference). The data already carries the fields after Task 6.

- `src/components/stats/HeadToHeadGrid.tsx` — 2 usages (`row`, `p`).
- `src/app/app/dashboard/DashboardClient.tsx` — 2 usages (`p`, `r`).
- `src/app/app/leagues/[id]/LeagueStatsClient.tsx` — 4 usages (`s`, `r`, `p`, `p`).

Example transformation:
```tsx
<Avatar seed={p.avatarSeed} name={p.name} size={24} />
```
becomes
```tsx
<Avatar seed={p.avatarSeed} name={p.name} size={24} color={p.color} icon={p.icon} />
```

- [ ] **Step 2: Players list — add `icon`**

`PlayersClient.tsx` already has `color` in its `Player` type and at the `<Avatar>` call. Add `icon`:

(a) In `src/app/app/players/PlayersClient.tsx`, the `Player` type is:
```ts
type Player = { id: string; name: string; avatarSeed: string; linkedUserId: string | null; color: string }
```
Change it to add `icon: string | null`:
```ts
type Player = { id: string; name: string; avatarSeed: string; linkedUserId: string | null; color: string; icon: string | null }
```
(b) At the `<Avatar seed={player.avatarSeed} name={player.name} size={40} />` call, add `color={player.color} icon={player.icon}`.

(c) In `src/app/app/players/page.tsx`, the `prisma.player.findMany` `select` is `{ id: true, name: true, avatarSeed: true, linkedUserId: true, color: true }`. Add `icon: true`.

- [ ] **Step 3: Players API route**

In `src/app/api/app/players/route.ts`, the select is `{ id: true, name: true, avatarSeed: true }`. Change it to `{ id: true, name: true, avatarSeed: true, color: true, icon: true }` so any client consuming this route has the avatar data available.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in any touched file. Pre-existing unrelated test-file errors — ignore.

- [ ] **Step 5: Manual verification**

Run `npm run dev`. With a custom avatar set (via `/app/settings`), confirm your pictogram avatar shows on the dashboard ranking, in a league's standings, and in the head-to-head grid — and on the `/app/players` list for your linked "me" player. Players without accounts still show initials.

- [ ] **Step 6: Commit**

```
git add src/components/stats/HeadToHeadGrid.tsx src/app/app/dashboard/DashboardClient.tsx "src/app/app/leagues/[id]/LeagueStatsClient.tsx" src/app/app/players/PlayersClient.tsx src/app/app/players/page.tsx src/app/api/app/players/route.ts
git commit -m "feat(ui): render the chosen avatar wherever players appear"
```

---

## Task 8: Profile and public-profile avatars

**Files:**
- Modify: `src/app/app/profile/page.tsx`, `src/app/app/profile/ProfileClient.tsx`
- Modify: `src/app/[locale]/u/[username]/page.tsx`, `src/components/social/PublicProfileHero.tsx`

These two surfaces render a bespoke initial-in-a-circle (not the `<Avatar>` component). Make each render the chosen pictogram-on-colour when set, else the existing initial. Verified by type-check + manual check.

- [ ] **Step 1: Profile page — select + pass the avatar fields**

In `src/app/app/profile/page.tsx`:
(a) Add `avatarColor: true` and `avatarIcon: true` to the `prisma.user.findUnique` `select` (next to `displayName: true`).
(b) Pass them to `<ProfileClient>` (next to `displayName={user.displayName}`):
```tsx
      avatarColor={user.avatarColor}
      avatarIcon={user.avatarIcon}
```

- [ ] **Step 2: ProfileClient — render the chosen avatar**

In `src/app/app/profile/ProfileClient.tsx`:
(a) Add two fields to the `Props` type, next to `displayName`:
```ts
  avatarColor: string | null
  avatarIcon: string | null
```
(b) The profile header currently renders a 44px circle with `{displayName.charAt(0).toUpperCase()}` on `background: '#f5a623'`. Replace the contents of that circle so a chosen avatar wins. The current block is:
```tsx
<div
  style={{
    width: 44, height: 44, borderRadius: '50%', background: '#f5a623', color: '#fefcf8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 18,
  }}
>
  {displayName.charAt(0).toUpperCase()}
</div>
```
Replace it with:
```tsx
<div
  style={{
    width: 44, height: 44, borderRadius: '50%',
    background: props.avatarIcon ? (props.avatarColor ?? '#f5a623') : '#f5a623',
    color: '#fefcf8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 18,
  }}
>
  {props.avatarIcon
    ? <span style={{ fontSize: 22, lineHeight: 1 }}>{props.avatarIcon}</span>
    : displayName.charAt(0).toUpperCase()}
</div>
```

- [ ] **Step 3: Public profile page — select + pass the avatar fields**

In `src/app/[locale]/u/[username]/page.tsx`, the `prisma.user.findUnique` that loads `profile` has a `select`. Add `avatarColor: true` and `avatarIcon: true` to it. Then pass them to `<PublicProfileHero>`:
```tsx
        avatarColor={profile.avatarColor}
        avatarIcon={profile.avatarIcon}
```

- [ ] **Step 4: PublicProfileHero — render the chosen avatar**

In `src/components/social/PublicProfileHero.tsx`:
(a) Add to the `Props` type:
```ts
  avatarColor: string | null
  avatarIcon: string | null
```
(b) Add `avatarColor` and `avatarIcon` to the destructured parameters.
(c) The hero renders a 72px circle currently containing `{name.charAt(0).toUpperCase()}` on `background: '#f5a623'`. Change the circle's `background` to `avatarIcon ? (avatarColor ?? '#f5a623') : '#f5a623'`, and change its content to:
```tsx
{avatarIcon
  ? <span style={{ fontSize: 34, lineHeight: 1 }}>{avatarIcon}</span>
  : name.charAt(0).toUpperCase()}
```
Leave the heading (`name`), the `@{username}` subline, and everything else unchanged.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in any of the four touched files. Pre-existing unrelated test-file errors — ignore.

- [ ] **Step 6: Manual verification**

Run `npm run dev`. With a custom avatar set, confirm the pictogram shows in the `/app/profile` header and on the public profile `/u/<username>` hero. With no custom avatar, both still show the initial.

- [ ] **Step 7: Commit**

```
git add src/app/app/profile/page.tsx src/app/app/profile/ProfileClient.tsx "src/app/[locale]/u/[username]/page.tsx" src/components/social/PublicProfileHero.tsx
git commit -m "feat(ui): chosen avatar on profile and public profile"
```

---

## Final Verification

- [ ] **Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `avatar-actions.test.ts` and the unchanged `src/lib/stats/*` tests.

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors in any file this plan created or modified.
