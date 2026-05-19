# Plan A — Social Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the engagement + public-profile half of the social spec (`docs/superpowers/specs/2026-05-17-social-feed-reactions-referral-design.md`): activity feed on `/app/profile`, reactions on approved games, two new notification types with batching, public profile at `/u/[username]` with three-state privacy.

**Architecture:** One additive Prisma migration (`PlayedGameReaction` + two `User` fields). Two new server actions (`toggleReaction`, `updatePrivacySettings`). Two new lib modules: `src/lib/social/loadFeed.ts` (two feed queries — personal vs public, the latter anonymized) and `src/lib/social/privacy.ts` (pure helpers). One new component family in `src/components/social/` (Scorecard, PublicProfileHero, TrophyShelf). Notification hooks fire from existing approval transition paths. Single commit per task; tests live colocated with code or in `src/test/`.

**Tech Stack:** Next.js 15 App Router · Prisma + PostgreSQL · Redis (ioredis) for reaction rate-limit · next-intl for i18n (`messages/{nl,en}/app.json`) · Vitest with mocked Prisma/Redis · Tailwind v3 + shadcn/ui · `lucide-react` icons · Tone matches existing `/app` warm-amber palette.

---

## Pre-flight

- [ ] **Verify on `main` with no uncommitted changes.**
   Run: `git status`
   Expected: `On branch main` / `nothing to commit, working tree clean`. If unclean, stash or commit first.

- [ ] **Confirm dev DB is migrated to current head.**
   Run: `npx prisma migrate status`
   Expected: `Database schema is up to date!`

- [ ] **Confirm tests pass on a clean tree before starting.**
   Run: `npm test -- --run`
   Expected: all green. If something already fails, surface it before adding more code.

---

## Task 1 — Schema migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_social_layer/migration.sql` (Prisma generates this)

- [ ] **Step 1: Add the three schema changes to `prisma/schema.prisma`.**

In the `User` model, add (preserve every other field — these go alongside `emailPreferences`):

```prisma
  // Privacy (Plan A)
  publicProfileMode   String   @default("private")  // 'private' | 'stats' | 'full'
  allowAppearInOthers Boolean  @default(false)

  // Reactions authored by this user
  reactionsAuthored   PlayedGameReaction[]
```

In the `PlayedGame` model, add the back-relation alongside `scores`:

```prisma
  reactions PlayedGameReaction[]
```

At the bottom of the file (after the existing models), add the new model:

```prisma
model PlayedGameReaction {
  id           String     @id @default(cuid())
  playedGameId String
  playedGame   PlayedGame @relation(fields: [playedGameId], references: [id], onDelete: Cascade)
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  emoji        String
  createdAt    DateTime   @default(now())

  @@unique([playedGameId, userId, emoji])
  @@index([playedGameId])
  @@index([userId])
}
```

- [ ] **Step 2: Generate the migration.**

Run: `npx prisma migrate dev --name social_layer`
Expected: Prisma applies the migration to the dev DB and regenerates the client. Migration file appears under `prisma/migrations/<timestamp>_social_layer/`.

If Prisma complains about pending migrations, run `npx prisma migrate status` to diagnose before retrying.

- [ ] **Step 3: Regenerate Prisma client explicitly (defensive).**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client (...)` with no errors.

- [ ] **Step 4: Commit.**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
feat(schema): PlayedGameReaction + User privacy fields for Plan A

Single additive migration. PlayedGameReaction enforces toggleability
via @@unique([playedGameId, userId, emoji]). User gains
publicProfileMode (string default 'private') and allowAppearInOthers
(bool default false).
EOF
)"
```

---

## Task 2 — Reactions allowed-set module

**Files:**
- Create: `src/lib/reactions.ts`
- Create: `src/lib/reactions.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `src/lib/reactions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ALLOWED_REACTIONS, isAllowedReaction } from '@/lib/reactions'

describe('ALLOWED_REACTIONS', () => {
  it('is exactly the five emoji from the spec', () => {
    expect(ALLOWED_REACTIONS).toEqual(['🔥', '👏', '🎲', '😅', '💪'])
  })
})

describe('isAllowedReaction', () => {
  it('returns true for any allowed emoji', () => {
    for (const e of ALLOWED_REACTIONS) expect(isAllowedReaction(e)).toBe(true)
  })
  it('returns false for an unrelated emoji', () => {
    expect(isAllowedReaction('🍕')).toBe(false)
  })
  it('returns false for a non-string', () => {
    expect(isAllowedReaction(42 as never)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test, expect failure.**

Run: `npm test -- --run src/lib/reactions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/reactions'`.

- [ ] **Step 3: Implement the module.**

Create `src/lib/reactions.ts`:

```typescript
export const ALLOWED_REACTIONS = ['🔥', '👏', '🎲', '😅', '💪'] as const
export type Reaction = typeof ALLOWED_REACTIONS[number]

export function isAllowedReaction(value: unknown): value is Reaction {
  return typeof value === 'string' && (ALLOWED_REACTIONS as readonly string[]).includes(value)
}
```

- [ ] **Step 4: Run the test, expect pass.**

Run: `npm test -- --run src/lib/reactions.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/reactions.ts src/lib/reactions.test.ts
git commit -m "feat(reactions): allowed-set constant + isAllowedReaction guard"
```

---

## Task 3 — Privacy helpers

**Files:**
- Create: `src/lib/social/privacy.ts`
- Create: `src/lib/social/privacy.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `src/lib/social/privacy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { canViewPublicProfile, shouldRenderGames, anonymizeName } from '@/lib/social/privacy'

describe('canViewPublicProfile', () => {
  it('rejects private mode', () => {
    expect(canViewPublicProfile({ publicProfileMode: 'private' })).toBe(false)
  })
  it('accepts stats mode', () => {
    expect(canViewPublicProfile({ publicProfileMode: 'stats' })).toBe(true)
  })
  it('accepts full mode', () => {
    expect(canViewPublicProfile({ publicProfileMode: 'full' })).toBe(true)
  })
  it('rejects unknown modes (defensive)', () => {
    expect(canViewPublicProfile({ publicProfileMode: 'whatever' })).toBe(false)
  })
})

describe('shouldRenderGames', () => {
  it('returns true only for full mode', () => {
    expect(shouldRenderGames({ publicProfileMode: 'full' })).toBe(true)
    expect(shouldRenderGames({ publicProfileMode: 'stats' })).toBe(false)
    expect(shouldRenderGames({ publicProfileMode: 'private' })).toBe(false)
  })
})

describe('anonymizeName', () => {
  it('returns real name when subject opted in', () => {
    expect(anonymizeName('public', { allowAppearInOthers: true, name: 'Anna' }, 0)).toBe('Anna')
  })
  it('returns "Speler {letter}" when subject opted out', () => {
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'Anna' }, 0)).toBe('Speler A')
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'Anna' }, 1)).toBe('Speler B')
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'Anna' }, 25)).toBe('Speler Z')
  })
  it('wraps past Z with AA, AB... (defensive for huge lobbies)', () => {
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'X' }, 26)).toBe('Speler AA')
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'X' }, 27)).toBe('Speler AB')
  })
})
```

- [ ] **Step 2: Run the test, expect failure.**

Run: `npm test -- --run src/lib/social/privacy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers.**

Create `src/lib/social/privacy.ts`:

```typescript
const VALID_MODES = new Set(['stats', 'full'])

export function canViewPublicProfile(profile: { publicProfileMode: string }): boolean {
  return VALID_MODES.has(profile.publicProfileMode)
}

export function shouldRenderGames(profile: { publicProfileMode: string }): boolean {
  return profile.publicProfileMode === 'full'
}

function indexToLetters(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

export function anonymizeName(
  viewer: 'public',
  subject: { allowAppearInOthers: boolean; name: string },
  opponentIndex: number,
): string {
  if (subject.allowAppearInOthers) return subject.name
  return `Speler ${indexToLetters(opponentIndex)}`
}
```

Note: `viewer` is typed `'public'` (not `string`) so misuse like passing a logged-in user's id is a compile error.

- [ ] **Step 4: Run the test, expect pass.**

Run: `npm test -- --run src/lib/social/privacy.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/social/privacy.ts src/lib/social/privacy.test.ts
git commit -m "feat(social): privacy helpers (canViewPublicProfile, shouldRenderGames, anonymizeName)"
```

---

## Task 4 — `loadPersonalFeed`

**Files:**
- Create: `src/lib/social/loadFeed.ts`
- Create: `src/lib/social/loadFeed.test.ts`

Implementation note: the spec's `PlayedGame.status` defaults to `'approved'` (see `prisma/schema.prisma` line 132). The filter is still mandatory because borrowed-league submissions land as `'pending'`.

Player resolution note: a viewer's "presence" in a league = a `LeagueMember` whose `Player.linkedUserId === viewerId` (i.e. they are the borrowed/connected player in someone else's vault). Their own vault contributes via `league.ownerId === viewerId`. The spec's SQL incorrectly used `p.userId`; the correct field is `p.linkedUserId`.

- [ ] **Step 1: Write the failing test.**

Create `src/lib/social/loadFeed.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playedGame: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { loadPersonalFeed } from '@/lib/social/loadFeed'

beforeEach(() => {
  vi.mocked(prisma.playedGame.count).mockResolvedValue(0 as never)
  vi.mocked(prisma.playedGame.findMany).mockResolvedValue([] as never)
})

describe('loadPersonalFeed', () => {
  it('filters to status=approved and the OR of ownership / borrowed-player membership', async () => {
    await loadPersonalFeed('user-1', 1, 10)
    const call = vi.mocked(prisma.playedGame.findMany).mock.calls[0]?.[0]
    expect(call?.where).toEqual({
      status: 'approved',
      OR: [
        { league: { ownerId: 'user-1' } },
        { league: { members: { some: { player: { linkedUserId: 'user-1' } } } } },
      ],
    })
  })

  it('orders by playedAt desc and paginates', async () => {
    await loadPersonalFeed('user-1', 3, 10)
    const call = vi.mocked(prisma.playedGame.findMany).mock.calls[0]?.[0]
    expect(call?.orderBy).toEqual({ playedAt: 'desc' })
    expect(call?.skip).toBe(20)
    expect(call?.take).toBe(10)
  })

  it('includes scores, league.gameTemplate, and reactions with a denormalized count', async () => {
    vi.mocked(prisma.playedGame.findMany).mockResolvedValueOnce([
      {
        id: 'g1',
        playedAt: new Date('2026-05-10T19:00:00Z'),
        league: { id: 'l1', name: 'Sundays', gameTemplate: { id: 't1', name: 'Risk', color: '#abc', icon: '🎲' } },
        scores: [{ id: 's1', score: 30, isWinner: true, player: { id: 'p1', name: 'Alice', linkedUserId: 'user-1' } }],
        reactions: [
          { emoji: '🔥', userId: 'user-1' },
          { emoji: '🔥', userId: 'user-2' },
          { emoji: '👏', userId: 'user-2' },
        ],
      },
    ] as never)
    vi.mocked(prisma.playedGame.count).mockResolvedValueOnce(1 as never)
    const result = await loadPersonalFeed('user-1', 1, 10)
    expect(result.total).toBe(1)
    expect(result.games[0]?.reactions).toEqual([
      { emoji: '🔥', count: 2, mine: true },
      { emoji: '👏', count: 1, mine: false },
    ])
  })
})
```

- [ ] **Step 2: Run the test, expect failure.**

Run: `npm test -- --run src/lib/social/loadFeed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the loader.**

Create `src/lib/social/loadFeed.ts`:

```typescript
import { prisma } from '@/lib/prisma'

export type FeedReaction = { emoji: string; count: number; mine: boolean }

export type FeedGame = {
  id: string
  playedAt: string
  league: { id: string; name: string }
  gameTemplate: { id: string; name: string; color: string; icon: string }
  scores: Array<{
    id: string
    playerId: string
    playerName: string
    score: number
    isWinner: boolean
    linkedUserId: string | null
  }>
  reactions: FeedReaction[]
}

export type FeedPage = {
  games: FeedGame[]
  total: number
  page: number
  totalPages: number
}

const INCLUDE = {
  league: { select: { id: true, name: true, gameTemplate: { select: { id: true, name: true, color: true, icon: true } } } },
  scores: {
    orderBy: { score: 'desc' } as const,
    select: {
      id: true,
      score: true,
      isWinner: true,
      player: { select: { id: true, name: true, linkedUserId: true } },
    },
  },
  reactions: { select: { emoji: true, userId: true } },
} as const

function denormalizeReactions(
  rows: Array<{ emoji: string; userId: string }>,
  viewerId: string | undefined,
): FeedReaction[] {
  const buckets = new Map<string, { count: number; mine: boolean }>()
  for (const r of rows) {
    const cur = buckets.get(r.emoji) ?? { count: 0, mine: false }
    cur.count += 1
    if (viewerId && r.userId === viewerId) cur.mine = true
    buckets.set(r.emoji, cur)
  }
  // Preserve insertion order (first-seen emoji order) — gives a stable rendering.
  return Array.from(buckets.entries()).map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }))
}

function mapRow(
  row: {
    id: string
    playedAt: Date
    league: { id: string; name: string; gameTemplate: { id: string; name: string; color: string; icon: string } }
    scores: Array<{ id: string; score: number; isWinner: boolean; player: { id: string; name: string; linkedUserId: string | null } }>
    reactions: Array<{ emoji: string; userId: string }>
  },
  viewerId: string | undefined,
): FeedGame {
  return {
    id: row.id,
    playedAt: row.playedAt.toISOString(),
    league: { id: row.league.id, name: row.league.name },
    gameTemplate: row.league.gameTemplate,
    scores: row.scores.map(s => ({
      id: s.id,
      playerId: s.player.id,
      playerName: s.player.name,
      score: s.score,
      isWinner: s.isWinner,
      linkedUserId: s.player.linkedUserId,
    })),
    reactions: denormalizeReactions(row.reactions, viewerId),
  }
}

export async function loadPersonalFeed(
  userId: string,
  page: number,
  perPage: number = 10,
): Promise<FeedPage> {
  const where = {
    status: 'approved' as const,
    OR: [
      { league: { ownerId: userId } },
      { league: { members: { some: { player: { linkedUserId: userId } } } } },
    ],
  }
  const [rows, total] = await Promise.all([
    prisma.playedGame.findMany({
      where,
      orderBy: { playedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: INCLUDE,
    }),
    prisma.playedGame.count({ where }),
  ])
  return {
    games: rows.map(r => mapRow(r as never, userId)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}
```

- [ ] **Step 4: Run the test, expect pass.**

Run: `npm test -- --run src/lib/social/loadFeed.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/social/loadFeed.ts src/lib/social/loadFeed.test.ts
git commit -m "feat(social): loadPersonalFeed with denormalized reactions"
```

---

## Task 5 — `loadPublicFeed` (with anonymization)

**Files:**
- Modify: `src/lib/social/loadFeed.ts` (add `loadPublicFeed` + opponent-anonymization helper)
- Modify: `src/lib/social/loadFeed.test.ts` (add public-feed test block)

Scope reminder: public-profile feed is "games the profile owner *played in*", not "games in their leagues". Played = a `ScoreEntry` whose `Player` represents the profile owner (their own self-Player has `userId === ownerId AND linkedUserId IS NULL`; their borrowed Player in others' vaults has `linkedUserId === ownerId`).

- [ ] **Step 1: Add the failing test cases.**

Append to `src/lib/social/loadFeed.test.ts`:

```typescript
import { loadPublicFeed } from '@/lib/social/loadFeed'

describe('loadPublicFeed', () => {
  it('filters to games where the profile owner has a ScoreEntry via a self-Player or linked Player', async () => {
    await loadPublicFeed('owner-1', 1, 10)
    const call = vi.mocked(prisma.playedGame.findMany).mock.calls.at(-1)?.[0]
    expect(call?.where).toEqual({
      status: 'approved',
      scores: {
        some: {
          player: {
            OR: [
              { linkedUserId: 'owner-1' },
              { userId: 'owner-1', linkedUserId: null },
            ],
          },
        },
      },
    })
  })

  it('anonymizes opponent names whose allowAppearInOthers is false', async () => {
    vi.mocked(prisma.playedGame.findMany).mockResolvedValueOnce([
      {
        id: 'g1',
        playedAt: new Date('2026-05-10T19:00:00Z'),
        league: { id: 'l1', name: 'Sundays', gameTemplate: { id: 't1', name: 'Risk', color: '#abc', icon: '🎲' } },
        scores: [
          { id: 's1', score: 30, isWinner: true, player: { id: 'p1', name: 'OwnerName', linkedUserId: 'owner-1', linkedUser: { allowAppearInOthers: true } } },
          { id: 's2', score: 20, isWinner: false, player: { id: 'p2', name: 'AnnaPrivate', linkedUserId: 'opp-1', linkedUser: { allowAppearInOthers: false } } },
          { id: 's3', score: 10, isWinner: false, player: { id: 'p3', name: 'BorisPublic', linkedUserId: 'opp-2', linkedUser: { allowAppearInOthers: true } } },
          { id: 's4', score: 5,  isWinner: false, player: { id: 'p4', name: 'UnlinkedFriend', linkedUserId: null, linkedUser: null } },
        ],
        reactions: [],
      },
    ] as never)
    vi.mocked(prisma.playedGame.count).mockResolvedValueOnce(1 as never)

    const result = await loadPublicFeed('owner-1', 1, 10)
    const names = result.games[0]?.scores.map(s => s.playerName)
    // owner's own row keeps real name; opted-out linked opponent becomes "Speler A";
    // opted-in opponent keeps name; unlinked player (no User to consult) keeps Player.name.
    expect(names).toEqual(['OwnerName', 'Speler A', 'BorisPublic', 'UnlinkedFriend'])
  })
})
```

- [ ] **Step 2: Run the test, expect failure.**

Run: `npm test -- --run src/lib/social/loadFeed.test.ts`
Expected: FAIL — `loadPublicFeed` does not exist.

- [ ] **Step 3: Extend the loader.**

In `src/lib/social/loadFeed.ts`:

Replace the existing `INCLUDE` constant with this expanded version (adds `linkedUser.allowAppearInOthers`):

```typescript
const INCLUDE = {
  league: { select: { id: true, name: true, gameTemplate: { select: { id: true, name: true, color: true, icon: true } } } },
  scores: {
    orderBy: { score: 'desc' } as const,
    select: {
      id: true,
      score: true,
      isWinner: true,
      player: {
        select: {
          id: true,
          name: true,
          linkedUserId: true,
          linkedUser: { select: { allowAppearInOthers: true } },
        },
      },
    },
  },
  reactions: { select: { emoji: true, userId: true } },
} as const
```

Update the `mapRow` function signature to accept the new `linkedUser` shape and to optionally apply anonymization. Replace the function with:

```typescript
import { anonymizeName } from '@/lib/social/privacy'

type RawRow = {
  id: string
  playedAt: Date
  league: { id: string; name: string; gameTemplate: { id: string; name: string; color: string; icon: string } }
  scores: Array<{
    id: string
    score: number
    isWinner: boolean
    player: {
      id: string
      name: string
      linkedUserId: string | null
      linkedUser: { allowAppearInOthers: boolean } | null
    }
  }>
  reactions: Array<{ emoji: string; userId: string }>
}

function mapRow(
  row: RawRow,
  viewerId: string | undefined,
  anonymizeFor: { profileOwnerId: string } | null,
): FeedGame {
  let opponentIndex = 0
  const scores = row.scores.map(s => {
    let displayName = s.player.name
    if (anonymizeFor && s.player.linkedUserId !== anonymizeFor.profileOwnerId) {
      // Only anonymize linked-to-a-user opponents whose owner opted out.
      // Unlinked Players (no linkedUser) are local labels in the profile owner's vault — render as-is.
      if (s.player.linkedUser && !s.player.linkedUser.allowAppearInOthers) {
        displayName = anonymizeName('public', { allowAppearInOthers: false, name: s.player.name }, opponentIndex)
      }
      opponentIndex += 1
    }
    return {
      id: s.id,
      playerId: s.player.id,
      playerName: displayName,
      score: s.score,
      isWinner: s.isWinner,
      linkedUserId: s.player.linkedUserId,
    }
  })
  return {
    id: row.id,
    playedAt: row.playedAt.toISOString(),
    league: { id: row.league.id, name: row.league.name },
    gameTemplate: row.league.gameTemplate,
    scores,
    reactions: denormalizeReactions(row.reactions, viewerId),
  }
}
```

Update the existing `loadPersonalFeed` call site to pass `null` for the anonymize argument:

```typescript
    games: rows.map(r => mapRow(r as RawRow, userId, null)),
```

Add `loadPublicFeed` at the bottom of the file:

```typescript
export async function loadPublicFeed(
  profileOwnerId: string,
  page: number,
  perPage: number = 10,
  viewerId?: string,
): Promise<FeedPage> {
  const where = {
    status: 'approved' as const,
    scores: {
      some: {
        player: {
          OR: [
            { linkedUserId: profileOwnerId },
            { userId: profileOwnerId, linkedUserId: null },
          ],
        },
      },
    },
  }
  const [rows, total] = await Promise.all([
    prisma.playedGame.findMany({
      where,
      orderBy: { playedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: INCLUDE,
    }),
    prisma.playedGame.count({ where }),
  ])
  return {
    games: rows.map(r => mapRow(r as RawRow, viewerId, { profileOwnerId })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}
```

- [ ] **Step 4: Run the test, expect pass.**

Run: `npm test -- --run src/lib/social/loadFeed.test.ts`
Expected: PASS, 5 tests total (3 personal + 2 public).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/social/loadFeed.ts src/lib/social/loadFeed.test.ts
git commit -m "feat(social): loadPublicFeed with opponent anonymization"
```

---

## Task 6 — `toggleReaction` server action

**Files:**
- Create: `src/app/app/social/actions.ts`
- Create: `src/test/social-actions.test.ts`

Rate limit: Redis `INCR` with 1s TTL keyed `react:{userId}:{playedGameId}:{emoji}`. If `INCR` returns > 1, return `rateLimited`.

- [ ] **Step 1: Write the failing test.**

Create `src/test/social-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playedGame: { findUnique: vi.fn() },
    playedGameReaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    leagueMember: { count: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/redis', () => ({
  redis: { incr: vi.fn(), expire: vi.fn() },
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { toggleReaction } from '@/app/app/social/actions'

const session = { user: { id: 'user-1', email: 'me@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(redis.incr).mockResolvedValue(1 as never)
  vi.mocked(redis.expire).mockResolvedValue(1 as never)
})

describe('toggleReaction', () => {
  it('rejects unknown emoji', async () => {
    const r = await toggleReaction('pg-1', '🍕')
    expect(r).toEqual({ error: 'invalidEmoji' })
  })

  it('rejects when rate-limited (incr > 1)', async () => {
    vi.mocked(redis.incr).mockResolvedValueOnce(2 as never)
    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ error: 'rateLimited' })
  })

  it('returns notFound for non-approved games', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1', status: 'pending', league: { id: 'l-1', ownerId: 'someone' },
    } as never)
    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ error: 'notFound' })
  })

  it('returns notAllowed when caller is not a member and not the owner', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1', status: 'approved', league: { id: 'l-1', ownerId: 'someone-else' },
    } as never)
    vi.mocked(prisma.leagueMember.count).mockResolvedValueOnce(0 as never)
    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ error: 'notAllowed' })
  })

  it('creates a new reaction when none exists, returns aggregated list', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1', status: 'approved', league: { id: 'l-1', ownerId: 'user-1' },
    } as never)
    vi.mocked(prisma.playedGameReaction.findUnique).mockResolvedValueOnce(null as never)
    vi.mocked(prisma.playedGameReaction.create).mockResolvedValueOnce({ id: 'r-1' } as never)
    vi.mocked(prisma.playedGameReaction.findMany).mockResolvedValueOnce([
      { emoji: '🔥', userId: 'user-1' },
    ] as never)

    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ reactions: [{ emoji: '🔥', count: 1, mine: true }] })
    expect(prisma.playedGameReaction.create).toHaveBeenCalledWith({
      data: { playedGameId: 'pg-1', userId: 'user-1', emoji: '🔥' },
    })
  })

  it('deletes when reaction exists (toggle off)', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1', status: 'approved', league: { id: 'l-1', ownerId: 'user-1' },
    } as never)
    vi.mocked(prisma.playedGameReaction.findUnique).mockResolvedValueOnce({ id: 'r-1' } as never)
    vi.mocked(prisma.playedGameReaction.delete).mockResolvedValueOnce({ id: 'r-1' } as never)
    vi.mocked(prisma.playedGameReaction.findMany).mockResolvedValueOnce([] as never)

    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ reactions: [] })
    expect(prisma.playedGameReaction.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } })
  })
})
```

- [ ] **Step 2: Run the test, expect failure.**

Run: `npm test -- --run src/test/social-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the action.**

Create `src/app/app/social/actions.ts`:

```typescript
'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { isAllowedReaction } from '@/lib/reactions'
import { redirect } from 'next/navigation'

type Result =
  | { reactions: Array<{ emoji: string; count: number; mine: boolean }> }
  | { error: 'notFound' | 'notAllowed' | 'invalidEmoji' | 'rateLimited' }

const RATE_LIMIT_TTL_SECONDS = 1

export async function toggleReaction(playedGameId: string, emoji: string): Promise<Result> {
  if (!isAllowedReaction(emoji)) return { error: 'invalidEmoji' }

  const session = await auth()
  if (!session) redirect('/en/auth/login')
  const userId = session.user.id

  // Rate limit per-user per-game per-emoji.
  const key = `react:${userId}:${playedGameId}:${emoji}`
  const hits = await redis.incr(key)
  if (hits === 1) await redis.expire(key, RATE_LIMIT_TTL_SECONDS)
  if (hits > 1) return { error: 'rateLimited' }

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId },
    select: { id: true, status: true, league: { select: { id: true, ownerId: true } } },
  })
  if (!pg || pg.status !== 'approved') return { error: 'notFound' }

  const isOwner = pg.league.ownerId === userId
  if (!isOwner) {
    const memberCount = await prisma.leagueMember.count({
      where: { leagueId: pg.league.id, player: { linkedUserId: userId } },
    })
    if (memberCount === 0) return { error: 'notAllowed' }
  }

  const existing = await prisma.playedGameReaction.findUnique({
    where: { playedGameId_userId_emoji: { playedGameId, userId, emoji } },
  })

  const wasCreating = !existing
  if (existing) {
    await prisma.playedGameReaction.delete({ where: { id: existing.id } })
  } else {
    await prisma.playedGameReaction.create({ data: { playedGameId, userId, emoji } })
  }

  // Re-aggregate reactions for the response.
  const allRows = await prisma.playedGameReaction.findMany({
    where: { playedGameId },
    select: { emoji: true, userId: true },
  })
  const buckets = new Map<string, { count: number; mine: boolean }>()
  for (const r of allRows) {
    const cur = buckets.get(r.emoji) ?? { count: 0, mine: false }
    cur.count += 1
    if (r.userId === userId) cur.mine = true
    buckets.set(r.emoji, cur)
  }
  const reactions = Array.from(buckets.entries()).map(([e, v]) => ({ emoji: e, count: v.count, mine: v.mine }))

  // Side effect: notify participants when an outsider reacts (creation only, not deletion).
  if (wasCreating) {
    const participants = await prisma.playedGame.findUnique({
      where: { id: playedGameId },
      select: {
        scores: {
          select: { player: { select: { userId: true, linkedUserId: true } } },
        },
        league: { select: { name: true, gameTemplate: { select: { name: true } } } },
      },
    })
    const participantUserIds = new Set<string>()
    for (const s of participants?.scores ?? []) {
      if (s.player.linkedUserId) participantUserIds.add(s.player.linkedUserId)
      else if (s.player.userId) participantUserIds.add(s.player.userId)
    }
    if (!participantUserIds.has(userId) && participantUserIds.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(participantUserIds).map(targetUserId => ({
          userId: targetUserId,
          type: 'reaction_received',
          meta: {
            playedGameId,
            emoji,
            actorUserId: userId,
            actorEmail: session.user.email,
            leagueName: participants?.league.name ?? null,
            gameName: participants?.league.gameTemplate.name ?? null,
          },
        })),
      })
    }
  }

  return { reactions }
}
```

- [ ] **Step 4: Run the test, expect pass.**

Run: `npm test -- --run src/test/social-actions.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/app/app/social/actions.ts src/test/social-actions.test.ts
git commit -m "feat(social): toggleReaction server action with Redis rate-limit + notify"
```

---

## Task 7 — `Scorecard` component

**Files:**
- Create: `src/components/social/Scorecard.tsx`

Visual reference: §3.1 of the spec. Card chrome matches existing stat panels. Tear-line decorative row of amber dots at top. Reaction strip footer with `+ react` popover.

- [ ] **Step 1: Implement the component.**

Create `src/components/social/Scorecard.tsx`:

```typescript
'use client'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { ALLOWED_REACTIONS } from '@/lib/reactions'
import { toggleReaction } from '@/app/app/social/actions'
import type { FeedGame, FeedReaction } from '@/lib/social/loadFeed'

type Props = {
  game: FeedGame
  canReact: boolean
  locale: 'nl' | 'en'
}

export function Scorecard({ game, canReact, locale }: Props) {
  const [reactions, setReactions] = useState<FeedReaction[]>(game.reactions)
  const [, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'

  function onToggle(emoji: string) {
    if (!canReact) return
    // Optimistic
    const prev = reactions
    const idx = prev.findIndex(r => r.emoji === emoji)
    const next: FeedReaction[] = idx === -1
      ? [...prev, { emoji, count: 1, mine: true }]
      : prev[idx]!.mine
        ? prev.flatMap(r => r.emoji === emoji ? (r.count === 1 ? [] : [{ ...r, count: r.count - 1, mine: false }]) : [r])
        : prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)
    setReactions(next)
    setPopoverOpen(false)
    startTransition(async () => {
      const result = await toggleReaction(game.id, emoji)
      if ('reactions' in result) setReactions(result.reactions)
      else setReactions(prev) // revert on error
    })
  }

  const winner = game.scores.find(s => s.isWinner)
  const others = game.scores.filter(s => !s.isWinner)
  const playedDate = new Date(game.playedAt)
  const timeAgo = playedDate.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })

  return (
    <article
      id={`game-${game.id}`}
      style={{
        background: '#fefcf8',
        border: '1px solid rgba(245,166,35,0.08)',
        boxShadow: '0 2px 16px rgba(30,26,20,0.07)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* tear-line */}
      <div
        aria-hidden
        style={{
          height: 8,
          background: 'repeating-linear-gradient(to right, rgba(245,166,35,0.35) 0 3px, transparent 3px 9px)',
        }}
      />

      <div style={{ padding: '14px 16px 12px' }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            style={{
              width: 28, height: 28, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${game.gameTemplate.color}2e`, fontSize: 16,
            }}
          >
            {game.gameTemplate.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 13, color: '#1e1a14' }}>
              {game.gameTemplate.name}
            </div>
            <div style={{ fontSize: 11, color: '#9a8c7a' }}>{game.league.name}</div>
          </div>
          <span style={{ fontSize: 11, color: '#9a8c7a' }}>{timeAgo}</span>
        </div>

        {/* Score block */}
        <ul className="space-y-1 mb-3">
          {winner && (
            <li
              key={winner.id}
              style={{ fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 18, color: '#f5a623' }}
            >
              {winner.playerName} <span style={{ fontSize: 14, fontWeight: 700 }}>{winner.score}</span>
            </li>
          )}
          {others.map(s => (
            <li key={s.id} style={{ fontSize: 13, color: '#1e1a14' }}>
              {s.playerName} <span style={{ color: '#6b5e4a' }}>{s.score}</span>
            </li>
          ))}
        </ul>

        {/* Reactions strip */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {reactions.map(r => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onToggle(r.emoji)}
              disabled={!canReact}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 999,
                background: r.mine ? '#fff3d4' : '#f7f2e8',
                border: r.mine ? '1px solid #f5a623' : '1px solid transparent',
                fontSize: 13, color: '#1e1a14', cursor: canReact ? 'pointer' : 'default',
                opacity: r.count > 0 ? 1 : 0.3,
              }}
            >
              <span>{r.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{r.count}</span>
            </button>
          ))}
          {canReact && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPopoverOpen(o => !o)}
                aria-label="React"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 999,
                  background: 'transparent', border: '1px dashed #c5b89f',
                  fontSize: 12, color: '#6b5e4a', cursor: 'pointer',
                }}
              >
                <Plus size={12} />
              </button>
              {popoverOpen && (
                <div
                  role="dialog"
                  style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
                    display: 'flex', gap: 6, padding: 8,
                    background: '#fefcf8', border: '1px solid #c5b89f',
                    borderRadius: 12, boxShadow: '0 8px 24px -8px rgba(60,40,15,0.2)',
                    zIndex: 20,
                  }}
                >
                  {ALLOWED_REACTIONS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => onToggle(e)}
                      style={{ fontSize: 20, background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Verify it type-checks.**

Run: `npx tsc --noEmit`
Expected: no errors (or only pre-existing ones unrelated to this file).

- [ ] **Step 3: Commit.**

```bash
git add src/components/social/Scorecard.tsx
git commit -m "feat(social): Scorecard component with optimistic reaction toggle"
```

---

## Task 8 — Reaction-count badge on `PaginatedGamesTable` (and `loadGames` extension)

**Files:**
- Modify: `src/lib/stats/loadGames.ts` (include reactions, expose count summary)
- Modify: `src/components/stats/PaginatedGamesTable.tsx` (extend `CompactGameRow` type, render badge)

- [ ] **Step 1: Extend `loadGames` to include reaction counts.**

In `src/lib/stats/loadGames.ts`, add `reactions: { select: { emoji: true } }` to the `include` block. Then in the `CompactGameRow` mapping, denormalize:

Replace the existing include block (lines 46-58 approximately) with:

```typescript
      include: {
        league: { select: { name: true, gameTemplate: { select: { name: true } } } },
        scores: {
          select: {
            playerId: true,
            score: true,
            isWinner: true,
            player: { select: { id: true, name: true } },
          },
          orderBy: { score: 'desc' },
        },
        reactions: { select: { emoji: true } },
      },
```

Add a small helper above `loadGames`:

```typescript
function summarizeReactions(rows: Array<{ emoji: string }>): Array<{ emoji: string; count: number }> {
  const buckets = new Map<string, number>()
  for (const r of rows) buckets.set(r.emoji, (buckets.get(r.emoji) ?? 0) + 1)
  return Array.from(buckets.entries()).map(([emoji, count]) => ({ emoji, count }))
}
```

In the compact-variant mapping, add `reactions: summarizeReactions(pg.reactions)`:

```typescript
    const games: CompactGameRow[] = rows.map(pg => ({
      id: pg.id,
      gameName: pg.league.gameTemplate.name,
      leagueName: pg.league.name,
      playedAt: pg.playedAt.toISOString(),
      playerNames: pg.scores.map(s => s.player.name),
      userWon: buildUserWon(pg),
      reactions: summarizeReactions(pg.reactions),
    }))
```

Same for the verbose variant — add `reactions: summarizeReactions(pg.reactions)` to the mapped object.

- [ ] **Step 2: Extend the `CompactGameRow` / `VerboseGameRow` types in `PaginatedGamesTable.tsx`.**

In `src/components/stats/PaginatedGamesTable.tsx`, replace the `CompactGameRow` type definition:

```typescript
export type CompactGameRow = {
  id: string
  gameName: string
  leagueName: string
  playedAt: string
  playerNames: string[]
  userWon: boolean | null
  reactions: { emoji: string; count: number }[]
}
```

`VerboseGameRow` extends `CompactGameRow`, so it inherits the field — no change needed there.

- [ ] **Step 3: Render the badge in `CompactRow`.**

In the same file, locate the `CompactRow` function. In the Desktop grid (`<div className="hidden md:grid" style={{ gridTemplateColumns: '1fr 120px 140px 90px' }}>`), the result column is the 4th. Add a reaction badge between players column and result. Update the grid columns and insert the badge:

Replace the Desktop grid block:

```tsx
      {/* Desktop: original 4-column grid (now 5 with reactions). */}
      <div className="hidden md:grid" style={{ gridTemplateColumns: '1fr 120px 1fr 90px 90px' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1a14' }}>{row.gameName}</div>
          <div style={{ fontSize: 11, color: '#6b5e4a' }}>{row.leagueName}</div>
        </div>
        <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>{dateText}</div>
        <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>{playersText}</div>
        <div style={{ paddingTop: 1 }}>
          <ReactionBadge reactions={row.reactions} gameId={row.id} />
        </div>
        <div style={{ paddingTop: 1 }}>{resultBadge}</div>
      </div>
```

In the Mobile stacked block, append a small reaction line below the meta line:

```tsx
        <div style={{ fontSize: 12, color: '#6b5e4a' }}>
          {dateText}
          {playersText && <> · {playersText}</>}
        </div>
        {row.reactions.length > 0 && (
          <ReactionBadge reactions={row.reactions} gameId={row.id} />
        )}
```

Add the `ReactionBadge` helper at the bottom of the file (before the closing `}` of the module):

```tsx
function ReactionBadge({ reactions, gameId }: { reactions: { emoji: string; count: number }[]; gameId: string }) {
  if (reactions.length === 0) return null
  const total = reactions.reduce((s, r) => s + r.count, 0)
  return (
    <a
      href={`/app/profile?game=${gameId}#game-${gameId}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: '#6b5e4a', textDecoration: 'none',
      }}
      aria-label={`${total} reactions`}
    >
      {reactions.map((r, i) => (
        <span key={r.emoji}>
          {i > 0 && <span style={{ opacity: 0.4, margin: '0 4px' }}>·</span>}
          {r.emoji} {r.count}
        </span>
      ))}
    </a>
  )
}
```

- [ ] **Step 4: Update the existing `loadGames` tests if they break.**

Run: `npm test -- --run src/lib/stats/`
Expected: existing tests still pass. If they break because they don't mock `reactions` on rows, fix by adding `reactions: []` to the mocked row shapes.

- [ ] **Step 5: Type-check.**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/stats/loadGames.ts src/components/stats/PaginatedGamesTable.tsx
git commit -m "feat(stats): reaction-count badge in PaginatedGamesTable compact + verbose rows"
```

---

## Task 9 — `PublicProfileHero` + `TrophyShelf` components

**Files:**
- Create: `src/lib/social/trophyShelf.ts` (pure helper, testable)
- Create: `src/lib/social/trophyShelf.test.ts`
- Create: `src/components/social/PublicProfileHero.tsx`
- Create: `src/components/social/TrophyShelf.tsx`

- [ ] **Step 1: Write the failing test for `computeTopThreeTemplates`.**

Create `src/lib/social/trophyShelf.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeTopThreeTemplates, type TemplatePlay } from '@/lib/social/trophyShelf'

describe('computeTopThreeTemplates', () => {
  it('returns top 3 by play count with win-rate', () => {
    const input: TemplatePlay[] = [
      { templateId: 't1', name: 'Risk', color: '#abc', icon: '🎲', isWinner: true },
      { templateId: 't1', name: 'Risk', color: '#abc', icon: '🎲', isWinner: false },
      { templateId: 't1', name: 'Risk', color: '#abc', icon: '🎲', isWinner: true },
      { templateId: 't2', name: 'Catan', color: '#def', icon: '🐑', isWinner: true },
      { templateId: 't3', name: 'Chess', color: '#ghi', icon: '♟️', isWinner: false },
      { templateId: 't3', name: 'Chess', color: '#ghi', icon: '♟️', isWinner: false },
      { templateId: 't4', name: 'Go', color: '#jkl', icon: '⚫', isWinner: true },
    ]
    expect(computeTopThreeTemplates(input)).toEqual([
      { templateId: 't1', name: 'Risk', color: '#abc', icon: '🎲', plays: 3, winRate: 2 / 3 },
      { templateId: 't3', name: 'Chess', color: '#ghi', icon: '♟️', plays: 2, winRate: 0 },
      { templateId: 't2', name: 'Catan', color: '#def', icon: '🐑', plays: 1, winRate: 1 },
    ])
  })

  it('returns empty array for no plays', () => {
    expect(computeTopThreeTemplates([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run, expect failure.**

Run: `npm test -- --run src/lib/social/trophyShelf.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper.**

Create `src/lib/social/trophyShelf.ts`:

```typescript
export type TemplatePlay = {
  templateId: string
  name: string
  color: string
  icon: string
  isWinner: boolean
}

export type TrophyEntry = {
  templateId: string
  name: string
  color: string
  icon: string
  plays: number
  winRate: number  // 0..1
}

export function computeTopThreeTemplates(plays: TemplatePlay[]): TrophyEntry[] {
  const buckets = new Map<string, { name: string; color: string; icon: string; plays: number; wins: number }>()
  for (const p of plays) {
    const cur = buckets.get(p.templateId) ?? { name: p.name, color: p.color, icon: p.icon, plays: 0, wins: 0 }
    cur.plays += 1
    if (p.isWinner) cur.wins += 1
    buckets.set(p.templateId, cur)
  }
  return Array.from(buckets.entries())
    .map(([templateId, v]) => ({
      templateId,
      name: v.name,
      color: v.color,
      icon: v.icon,
      plays: v.plays,
      winRate: v.plays === 0 ? 0 : v.wins / v.plays,
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 3)
}
```

- [ ] **Step 4: Run, expect pass.**

Run: `npm test -- --run src/lib/social/trophyShelf.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Implement `PublicProfileHero`.**

Create `src/components/social/PublicProfileHero.tsx`:

```typescript
type Props = {
  username: string
  avatarSeed: string
  gamesCount: number
  winsCount: number
  winRate: number  // 0..1
}

export function PublicProfileHero({ username, avatarSeed: _avatarSeed, gamesCount, winsCount, winRate }: Props) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #fff3d4, #fff7d8)',
        backgroundImage: 'radial-gradient(rgba(245,166,35,0.12) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        borderRadius: 24,
        padding: '32px 24px',
      }}
    >
      <div className="flex items-center gap-4">
        <div
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#f5a623', border: '3px solid #f5a623',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 28, color: '#fefcf8',
          }}
        >
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1
            style={{
              fontFamily: 'var(--font-headline)', fontWeight: 900,
              fontSize: 38, color: '#1e1a14', letterSpacing: '-0.03em',
              textShadow: '0 0 36px rgba(245,166,35,0.3)',
              textTransform: 'uppercase', lineHeight: 1,
            }}
          >
            {username}
          </h1>
          <p style={{ fontSize: 14, color: '#6b5e4a', marginTop: 8 }}>
            @{username} · {gamesCount} games · {winsCount} wins · {Math.round(winRate * 100)}% wr
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Implement `TrophyShelf`.**

Create `src/components/social/TrophyShelf.tsx`:

```typescript
import type { TrophyEntry } from '@/lib/social/trophyShelf'

export function TrophyShelf({ entries, heading }: { entries: TrophyEntry[]; heading: string }) {
  if (entries.length === 0) return null
  return (
    <section style={{ marginTop: 24 }}>
      <h2
        style={{
          fontFamily: 'var(--font-headline)', fontWeight: 700,
          fontSize: 13, color: '#9a8878', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 12,
        }}
      >
        {heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {entries.map(e => (
          <div
            key={e.templateId}
            style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 16, overflow: 'hidden' }}
          >
            <div style={{ height: 4, background: e.color }} />
            <div style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 20 }}>{e.icon}</span>
                <span style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 14, color: '#1e1a14' }}>
                  {e.name}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b5e4a' }}>
                {e.plays} games · {Math.round(e.winRate * 100)}% wr
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Commit.**

```bash
git add src/lib/social/trophyShelf.ts src/lib/social/trophyShelf.test.ts \
        src/components/social/PublicProfileHero.tsx src/components/social/TrophyShelf.tsx
git commit -m "feat(social): PublicProfileHero + TrophyShelf with computeTopThreeTemplates helper"
```

---

## Task 10 — Privacy section in `/app/settings`

**Files:**
- Modify: `src/app/app/settings/actions.ts` (add `updatePrivacySettings`)
- Create: `src/app/app/settings/sections/PrivacySection.tsx`
- Modify: `src/app/app/settings/SettingsClient.tsx` (mount the section) — exact file may be named differently; locate it by reading `src/app/app/settings/page.tsx` first
- Create: `src/test/settings-privacy.test.ts`
- Modify: `messages/en/app.json` + `messages/nl/app.json`

- [ ] **Step 1: Locate the settings client file.**

Use the Glob tool with pattern `src/app/app/settings/**/*.tsx`, or run `rg --files src/app/app/settings`. The page is at `src/app/app/settings/page.tsx`; identify which client component it renders (likely `SettingsClient.tsx`). Read it before proceeding so you know where to mount `PrivacySection`.

- [ ] **Step 2: Write the failing test for the action.**

Create `src/test/settings-privacy.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { updatePrivacySettings } from '@/app/app/settings/actions'

const session = { user: { id: 'user-1', email: 'me@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('updatePrivacySettings', () => {
  it('writes the validated values to the user row', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never)
    await updatePrivacySettings({ publicProfileMode: 'full', allowAppearInOthers: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { publicProfileMode: 'full', allowAppearInOthers: true },
    })
  })

  it('rejects an unknown mode', async () => {
    await expect(updatePrivacySettings({ publicProfileMode: 'bogus' as never, allowAppearInOthers: false }))
      .rejects.toThrow()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run, expect failure.**

Run: `npm test -- --run src/test/settings-privacy.test.ts`
Expected: FAIL — `updatePrivacySettings` does not exist (or import fails).

- [ ] **Step 4: Add the action to `src/app/app/settings/actions.ts`.**

Append (preserve all existing exports):

```typescript
const VALID_PROFILE_MODES = new Set(['private', 'stats', 'full'])

export async function updatePrivacySettings(input: {
  publicProfileMode: 'private' | 'stats' | 'full'
  allowAppearInOthers: boolean
}) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  if (!VALID_PROFILE_MODES.has(input.publicProfileMode)) {
    throw new Error('Invalid publicProfileMode')
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      publicProfileMode: input.publicProfileMode,
      allowAppearInOthers: input.allowAppearInOthers,
    },
  })
  revalidatePath('/app/settings')
  revalidatePath('/app/profile')
}
```

If `auth`/`prisma`/`redirect`/`revalidatePath` aren't already imported in this file, add them.

- [ ] **Step 5: Run, expect pass.**

Run: `npm test -- --run src/test/settings-privacy.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Create the `PrivacySection` client component.**

Create `src/app/app/settings/sections/PrivacySection.tsx`:

```typescript
'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { updatePrivacySettings } from '../actions'

type Props = {
  initial: {
    publicProfileMode: 'private' | 'stats' | 'full'
    allowAppearInOthers: boolean
  }
}

export function PrivacySection({ initial }: Props) {
  const t = useTranslations('app.social')
  const [mode, setMode] = useState(initial.publicProfileMode)
  const [appear, setAppear] = useState(initial.allowAppearInOthers)
  const [, startTransition] = useTransition()

  const masterOn = mode !== 'private'

  function commit(next: { mode?: typeof mode; appear?: typeof appear }) {
    const nextMode = next.mode ?? mode
    const nextAppear = next.appear ?? appear
    startTransition(async () => {
      try {
        await updatePrivacySettings({ publicProfileMode: nextMode, allowAppearInOthers: nextAppear })
        toast.success(t('settingsSaved'))
      } catch {
        toast.error(t('settingsSaveFailed'))
      }
    })
  }

  function toggleMaster(on: boolean) {
    const newMode: typeof mode = on ? (mode === 'private' ? 'stats' : mode) : 'private'
    setMode(newMode)
    commit({ mode: newMode })
  }

  function pickSubMode(next: 'stats' | 'full') {
    setMode(next)
    commit({ mode: next })
  }

  function toggleAppear(on: boolean) {
    setAppear(on)
    commit({ appear: on })
  }

  return (
    <section id="privacy" style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 16, color: '#1e1a14', marginBottom: 16 }}>
        {t('publicProfileSectionHeading')}
      </h2>

      {/* Master toggle */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: '#f0ebe3' }}>
        <div className="flex-1 min-w-0">
          <p style={{ fontWeight: 600, fontSize: 14, color: '#1e1a14' }}>{t('publicProfileMasterToggle')}</p>
          <p style={{ fontSize: 12, color: '#6b5e4a', marginTop: 4 }}>{t('publicProfileMasterBody')}</p>
        </div>
        <Switch checked={masterOn} onChange={toggleMaster} />
      </div>

      {/* Sub-radio (dimmed when off) */}
      <fieldset disabled={!masterOn} style={{ opacity: masterOn ? 1 : 0.5, marginTop: 12, paddingBottom: 12, borderBottom: '1px solid #f0ebe3' }}>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="radio" name="publicMode" checked={mode === 'stats'} onChange={() => pickSubMode('stats')} />
          <span style={{ fontSize: 13, color: '#1e1a14' }}>{t('publicProfileModeStats')}</span>
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="radio" name="publicMode" checked={mode === 'full'} onChange={() => pickSubMode('full')} />
          <span style={{ fontSize: 13, color: '#1e1a14' }}>{t('publicProfileModeFull')}</span>
        </label>
      </fieldset>

      {/* Appear-in-others */}
      <div className="flex items-start justify-between gap-4 pt-4">
        <div className="flex-1 min-w-0">
          <p style={{ fontWeight: 600, fontSize: 14, color: '#1e1a14' }}>{t('appearInOthersToggle')}</p>
          <p style={{ fontSize: 12, color: '#6b5e4a', marginTop: 4 }}>{t('appearInOthersBody')}</p>
        </div>
        <Switch checked={appear} onChange={toggleAppear} />
      </div>
    </section>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999,
        background: checked ? '#f5a623' : '#d8cfc2',
        position: 'relative', transition: 'background 180ms',
        border: 'none', cursor: 'pointer', flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fefcf8',
          transition: 'left 180ms', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
```

- [ ] **Step 7: Mount the section in the settings page/client.**

Open the settings client component (located in Step 1). Import `PrivacySection` and render it alongside the existing sections, passing `publicProfileMode` and `allowAppearInOthers` loaded from the server. Update `page.tsx` to add those fields to the `prisma.user.findUnique` select.

Example added select fields:

```typescript
  publicProfileMode: true,
  allowAppearInOthers: true,
```

And in the client render:

```tsx
<PrivacySection initial={{
  publicProfileMode: user.publicProfileMode as 'private' | 'stats' | 'full',
  allowAppearInOthers: user.allowAppearInOthers,
}} />
```

- [ ] **Step 8: Add i18n keys.**

Append to `messages/en/app.json` (inside the top-level object, as a new key `social`):

```json
"social": {
  "publicProfileSectionHeading": "Profile & privacy",
  "publicProfileMasterToggle": "Public profile",
  "publicProfileMasterBody": "Show your profile at dicevault.fun/u/{username} to anyone with the link.",
  "publicProfileModeStats": "Stats only",
  "publicProfileModeFull": "Stats + recent games",
  "privacyChipPrivate": "Private",
  "appearInOthersToggle": "Name in others' profiles",
  "appearInOthersBody": "When an opponent makes their profile public, may your name appear in their recent games?",
  "publicProfileNotFoundTitle": "Profile not found",
  "publicProfileNotFoundBody": "This user doesn't exist or has a private profile.",
  "publicProfileAnonymousLabel": "Player {letter}",
  "trophyShelfHeading": "Trophies",
  "publicGamesHeading": "Recent games",
  "feedHeading": "Recent activity",
  "feedEmpty": "Nothing logged yet. Log your first game to begin.",
  "reactionTooltipReact": "React",
  "reactionTooltipUnreact": "Remove reaction",
  "reactionWhoReacted": "Who reacted",
  "compactRowReactionsAria": "{count} reactions",
  "settingsSaved": "Saved.",
  "settingsSaveFailed": "Couldn't save — try again."
}
```

Add the Dutch equivalent to `messages/nl/app.json`:

```json
"social": {
  "publicProfileSectionHeading": "Profiel & privacy",
  "publicProfileMasterToggle": "Openbaar profiel",
  "publicProfileMasterBody": "Toon je profiel op dicevault.fun/u/{username} aan iedereen met de link.",
  "publicProfileModeStats": "Alleen statistieken",
  "publicProfileModeFull": "Statistieken + recente partijen",
  "privacyChipPrivate": "Privé",
  "appearInOthersToggle": "Mijn naam in andermans profielen",
  "appearInOthersBody": "Als een tegenstander zijn profiel openbaar maakt, mag jouw naam dan getoond worden in zijn recente partijen?",
  "publicProfileNotFoundTitle": "Profiel niet gevonden",
  "publicProfileNotFoundBody": "Deze gebruiker bestaat niet of heeft een privéprofiel.",
  "publicProfileAnonymousLabel": "Speler {letter}",
  "trophyShelfHeading": "Trofeeën",
  "publicGamesHeading": "Recente partijen",
  "feedHeading": "Recente activiteit",
  "feedEmpty": "Nog niets gelogd. Log je eerste partij om te beginnen.",
  "reactionTooltipReact": "Reageer",
  "reactionTooltipUnreact": "Verwijder reactie",
  "reactionWhoReacted": "Wie reageerde",
  "compactRowReactionsAria": "{count} reacties",
  "settingsSaved": "Opgeslagen.",
  "settingsSaveFailed": "Niet gelukt om op te slaan."
}
```

- [ ] **Step 9: Type-check + tests.**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: green.

- [ ] **Step 10: Commit.**

```bash
git add src/app/app/settings src/test/settings-privacy.test.ts messages/en/app.json messages/nl/app.json
git commit -m "feat(settings): Profile & privacy section with updatePrivacySettings action"
```

---

## Task 11 — `/u/[username]` public page

**Files:**
- Create: `src/app/[locale]/u/[username]/page.tsx`

- [ ] **Step 1: Implement the route.**

Create `src/app/[locale]/u/[username]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getTranslations } from 'next-intl/server'
import { canViewPublicProfile, shouldRenderGames } from '@/lib/social/privacy'
import { loadPublicFeed } from '@/lib/social/loadFeed'
import { computeTopThreeTemplates } from '@/lib/social/trophyShelf'
import { PublicProfileHero } from '@/components/social/PublicProfileHero'
import { TrophyShelf } from '@/components/social/TrophyShelf'
import { Scorecard } from '@/components/social/Scorecard'

type Props = {
  params: Promise<{ locale: 'nl' | 'en'; username: string }>
}

export default async function PublicProfilePage({ params }: Props) {
  const { locale, username } = await params
  const t = await getTranslations({ locale, namespace: 'app.social' })

  const profile = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      publicProfileMode: true,
      allowAppearInOthers: true,
    },
  })
  if (!profile || !profile.username || !canViewPublicProfile(profile)) notFound()

  const session = await auth()
  const viewerId = session?.user.id

  const [scoreRows, feed] = await Promise.all([
    prisma.scoreEntry.findMany({
      where: {
        player: {
          OR: [
            { linkedUserId: profile.id },
            { userId: profile.id, linkedUserId: null },
          ],
        },
        playedGame: { status: 'approved' },
      },
      select: {
        isWinner: true,
        playedGame: {
          select: { league: { select: { gameTemplate: { select: { id: true, name: true, color: true, icon: true } } } } },
        },
      },
    }),
    shouldRenderGames(profile)
      ? loadPublicFeed(profile.id, 1, 10, viewerId)
      : Promise.resolve(null),
  ])

  const gamesCount = scoreRows.length
  const winsCount = scoreRows.filter(r => r.isWinner).length
  const winRate = gamesCount === 0 ? 0 : winsCount / gamesCount

  const trophies = computeTopThreeTemplates(scoreRows.map(r => ({
    templateId: r.playedGame.league.gameTemplate.id,
    name: r.playedGame.league.gameTemplate.name,
    color: r.playedGame.league.gameTemplate.color,
    icon: r.playedGame.league.gameTemplate.icon,
    isWinner: r.isWinner,
  })))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <PublicProfileHero
        username={profile.username}
        avatarSeed={profile.username}
        gamesCount={gamesCount}
        winsCount={winsCount}
        winRate={winRate}
      />
      <TrophyShelf entries={trophies} heading={t('trophyShelfHeading')} />
      {feed && (
        <section style={{ marginTop: 24 }}>
          <h2
            style={{
              fontFamily: 'var(--font-headline)', fontWeight: 700,
              fontSize: 13, color: '#9a8878', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 12,
            }}
          >
            {t('publicGamesHeading')}
          </h2>
          <div className="space-y-3">
            {feed.games.map(g => (
              <Scorecard key={g.id} game={g} canReact={false} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Visit a public profile in dev.**

Manually: pick a user with `publicProfileMode = 'full'` in the DB (UPDATE `User` SET `publicProfileMode` = 'full' WHERE username = 'someone'), start the dev server (`npm run dev`), hit `/en/u/<username>`. Verify hero renders, trophies render, scorecards render.

Then set the user back to `private` and confirm `/en/u/<username>` 404s.

- [ ] **Step 3: Commit.**

```bash
git add src/app/[locale]/u
git commit -m "feat(social): public profile page at /u/[username] with hero + trophies + games"
```

---

## Task 12 — Restructure `/app/profile` with feed + deep-link resolver

**Files:**
- Modify: `src/app/app/profile/page.tsx`
- Modify: `src/app/app/profile/ProfileClient.tsx`
- Create: `src/lib/social/findGamePage.ts`
- Create: `src/lib/social/findGamePage.test.ts`

- [ ] **Step 1: Write the failing test for `findGamePageNumber`.**

Create `src/lib/social/findGamePage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { playedGame: { findUnique: vi.fn(), count: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { findGamePageNumber } from '@/lib/social/findGamePage'

beforeEach(() => vi.clearAllMocks())

describe('findGamePageNumber', () => {
  it('returns 1 when the target game is among the most recent', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({ playedAt: new Date('2026-05-15') } as never)
    vi.mocked(prisma.playedGame.count).mockResolvedValueOnce(3 as never) // 3 newer games
    const page = await findGamePageNumber({ targetGameId: 'g1', userId: 'u1', perPage: 10 })
    expect(page).toBe(1)
  })

  it('returns the right page when target sits deeper', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({ playedAt: new Date('2026-04-01') } as never)
    vi.mocked(prisma.playedGame.count).mockResolvedValueOnce(24 as never) // 24 newer => target is item 25 => page 3 (1-indexed, 10/pg)
    const page = await findGamePageNumber({ targetGameId: 'g1', userId: 'u1', perPage: 10 })
    expect(page).toBe(3)
  })

  it('returns 1 if target not found (graceful)', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce(null as never)
    const page = await findGamePageNumber({ targetGameId: 'missing', userId: 'u1', perPage: 10 })
    expect(page).toBe(1)
  })
})
```

- [ ] **Step 2: Run, expect failure.**

Run: `npm test -- --run src/lib/social/findGamePage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper.**

Create `src/lib/social/findGamePage.ts`:

```typescript
import { prisma } from '@/lib/prisma'

export async function findGamePageNumber({
  targetGameId,
  userId,
  perPage,
}: {
  targetGameId: string
  userId: string
  perPage: number
}): Promise<number> {
  const target = await prisma.playedGame.findUnique({
    where: { id: targetGameId },
    select: { playedAt: true },
  })
  if (!target) return 1
  // Count games newer than the target that are in the same scope as loadPersonalFeed.
  const newerCount = await prisma.playedGame.count({
    where: {
      status: 'approved',
      playedAt: { gt: target.playedAt },
      OR: [
        { league: { ownerId: userId } },
        { league: { members: { some: { player: { linkedUserId: userId } } } } },
      ],
    },
  })
  // Target is at zero-indexed position newerCount in the descending list.
  return Math.floor(newerCount / perPage) + 1
}
```

- [ ] **Step 4: Run, expect pass.**

Run: `npm test -- --run src/lib/social/findGamePage.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Update `src/app/app/profile/page.tsx` to load the feed.**

Replace the file contents:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ProfileClient } from './ProfileClient'
import { ensureConnectToken, buildConnectUrl } from '@/lib/connectToken'
import { loadPersonalFeed } from '@/lib/social/loadFeed'
import { findGamePageNumber } from '@/lib/social/findGamePage'

const PER_PAGE = 10

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; game?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  const params = await searchParams

  // Resolve target page from ?game= (deep-link) or ?page= (pagination), default 1.
  let page = 1
  if (params.game) page = await findGamePageNumber({ targetGameId: params.game, userId: session.user.id, perPage: PER_PAGE })
  else if (params.page) page = Math.max(1, Number.parseInt(params.page, 10) || 1)

  const [user, connections, connectToken, feed] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        username: true,
        createdAt: true,
        publicProfileMode: true,
      },
    }),
    prisma.vaultConnection.findMany({
      where: { userId: session.user.id },
      include: { connectedUser: { select: { email: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    ensureConnectToken(session.user.id),
    loadPersonalFeed(session.user.id, page, PER_PAGE),
  ])
  if (!user) redirect('/en/auth/login')

  return (
    <ProfileClient
      email={user.email}
      username={user.username}
      signupMonth={user.createdAt.toISOString()}
      publicProfileMode={user.publicProfileMode as 'private' | 'stats' | 'full'}
      connectUrl={buildConnectUrl(connectToken)}
      connections={connections.map(c => ({ email: c.connectedUser.email, username: c.connectedUser.username }))}
      feed={feed}
      focusGameId={params.game ?? null}
    />
  )
}
```

- [ ] **Step 6: Rewrite `ProfileClient.tsx` to add identity card + feed.**

Open the file and replace the entire body. (Preserve the existing share/QR/username-update behaviors — they get folded into the new identity card.) Suggested structure:

```typescript
'use client'
import { useEffect, useRef, useState, useActionState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Share2, QrCode, Settings, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { QRCodeCanvas } from './QRCode'
import { updateUsername } from './actions'
import { Scorecard } from '@/components/social/Scorecard'
import type { FeedPage } from '@/lib/social/loadFeed'

type Props = {
  email: string
  username: string | null
  signupMonth: string
  publicProfileMode: 'private' | 'stats' | 'full'
  connectUrl: string
  connections: { email: string; username: string | null }[]
  feed: FeedPage
  focusGameId: string | null
}

export function ProfileClient(props: Props) {
  const t = useTranslations('app.social')
  const tp = useTranslations('app.profile')
  const locale = useLocale() as 'nl' | 'en'
  const [qrOpen, setQrOpen] = useState(false)
  const [, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => updateUsername(formData),
    null,
  )
  const focusRef = useRef<HTMLDivElement>(null)
  const displayName = props.username ?? props.email

  useEffect(() => {
    if (props.focusGameId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [props.focusGameId])

  async function handleShare() {
    const shareData = {
      title: tp('shareTitle'),
      text: `${tp('shareText')} ${props.connectUrl}`,
      url: props.connectUrl,
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share(shareData); return }
      catch (err) { if ((err as Error).name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(props.connectUrl); toast.success(tp('linkCopied')) }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${tp('shareText')} ${props.connectUrl}`)}`, '_blank') }
  }

  const privacyChipLabel =
    props.publicProfileMode === 'full' ? `${t('publicProfileMasterToggle')} (${t('publicProfileModeFull')})`
    : props.publicProfileMode === 'stats' ? `${t('publicProfileMasterToggle')} (${t('publicProfileModeStats')})`
    : t('privacyChipPrivate')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Identity card */}
      <section style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 24, padding: 20 }}>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 44, height: 44, borderRadius: '50%', background: '#f5a623', color: '#fefcf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 18,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 18, color: '#1e1a14' }}>
              {displayName}
            </p>
            <p style={{ fontSize: 11, color: '#9a8878' }}>
              {props.username && `@${props.username} · `}
              {new Date(props.signupMonth).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Link
            href="/app/settings#privacy"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 999,
              background: props.publicProfileMode === 'private' ? '#f7f2e8' : '#fff3d4',
              color: props.publicProfileMode === 'private' ? '#6b5e4a' : '#c27f0a',
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
            }}
          >
            {privacyChipLabel}
          </Link>
          <button onClick={() => setQrOpen(true)} aria-label="QR" style={chipBtnStyle}>
            <QrCode size={14} />
          </button>
          <Link href="/app/settings" aria-label="Settings" style={{ ...chipBtnStyle, color: '#6b5e4a' }}>
            <Settings size={14} />
          </Link>
        </div>
        {/* Username editor */}
        <form action={formAction} className="flex gap-2 mt-4">
          <input
            name="username"
            defaultValue={props.username ?? ''}
            placeholder="e.g. jan_de_vries"
            className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm outline-none"
            style={{ background: '#f5f0e8', border: '1px solid #e8e1d8', color: '#1e1a14' }}
          />
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {pending ? '…' : tp('save')}
          </button>
        </form>
      </section>

      {/* QR sheet */}
      {qrOpen && (
        <div
          role="dialog"
          onClick={() => setQrOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(30,26,20,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fefcf8', borderRadius: 24, padding: 24, maxWidth: 320, width: '100%' }}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 14, color: '#1e1a14' }}>
                {tp('shareTitle')}
              </span>
              <button onClick={() => setQrOpen(false)} aria-label="Close"><X size={18} color="#6b5e4a" /></button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <QRCodeCanvas value={props.connectUrl} />
              <button onClick={handleShare} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-headline font-bold text-sm" style={{ background: '#f5a623', color: '#1c1408' }}>
                <Share2 size={15} /> {tp('share')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity feed */}
      <section ref={focusRef}>
        <h2 style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 13, color: '#9a8878', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          {t('feedHeading')}
        </h2>
        {props.feed.games.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9a8c7a', textAlign: 'center', padding: '20px' }}>{t('feedEmpty')}</p>
        ) : (
          <>
            <div className="space-y-3">
              {props.feed.games.map(g => (
                <Scorecard key={g.id} game={g} canReact locale={locale} />
              ))}
            </div>
            {props.feed.totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                {props.feed.page > 1
                  ? <Link href={`/app/profile?page=${props.feed.page - 1}`} aria-label="Previous page" style={pagerStyle}><ChevronLeft size={14} /></Link>
                  : <span />}
                <span style={{ fontSize: 12, color: '#9a8878' }}>{props.feed.page} / {props.feed.totalPages}</span>
                {props.feed.page < props.feed.totalPages
                  ? <Link href={`/app/profile?page=${props.feed.page + 1}`} aria-label="Next page" style={pagerStyle}><ChevronRight size={14} /></Link>
                  : <span />}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

const chipBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: '50%',
  background: '#f7f2e8', border: 'none', cursor: 'pointer',
  color: '#1e1a14',
}

const pagerStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8,
  border: '1px solid #c5b89f', background: '#fefcf8',
  fontSize: 12, fontWeight: 600, color: '#1e1a14', textDecoration: 'none',
}
```

- [ ] **Step 7: Visit `/app/profile` in dev.**

Run: `npm run dev`
Open `/en/app/profile`. Expect: identity card with privacy chip + QR + settings button; activity feed below with scorecards from your leagues; pagination works; clicking a reaction toggles and persists.

Open `/en/app/profile?game=<some-game-id>` and verify the page resolves to the right page and scrolls.

- [ ] **Step 8: Commit.**

```bash
git add src/app/app/profile src/lib/social/findGamePage.ts src/lib/social/findGamePage.test.ts
git commit -m "feat(profile): identity card + activity feed + ?game= deep-link resolver"
```

---

## Task 13 — Two new notification types in client + bell + email

**Files:**
- Modify: `src/app/app/notifications/NotificationsClient.tsx`
- Modify: `src/components/layout/NotificationBell.tsx`
- Locate: email templates file (`src/lib/email/templates.ts` or similar; find via Glob)
- Locate: `shouldSendEmailTo` helper
- Modify: `messages/en/app.json` + `messages/nl/app.json` (notification labels + email subjects/bodies)

- [ ] **Step 1: Find the email/preferences files.**

Use the Glob tool with patterns `src/lib/**/email*.{ts,tsx}` and `src/lib/**/emailPreferences*`. Or run `rg --files src/lib | rg -i email`. Read whichever files exist. Identify (a) the function that builds an email body per notification type, and (b) the `shouldSendEmailTo` (or equivalent) helper that consults `User.emailPreferences`. The implementations in steps 5–6 below need adapting to that file's exact shape.

- [ ] **Step 2: Extend `iconFor`/`colorFor`/`hrefFor`/`label` in `NotificationsClient.tsx`.**

In `src/app/app/notifications/NotificationsClient.tsx`:

Add `Dices, Sparkles` to the existing `lucide-react` import.

Add cases to `hrefFor`:

```typescript
    case 'connection_game_logged':
    case 'reaction_received': {
      const playedGameId = typeof meta.playedGameId === 'string' ? meta.playedGameId : null
      return playedGameId ? `/app/profile?game=${playedGameId}` : '/app/profile'
    }
```

Add cases to `iconFor`:

```typescript
    case 'connection_game_logged': return Dices
    case 'reaction_received': return Sparkles
```

Add cases to `colorFor`:

```typescript
    case 'connection_game_logged':
    case 'reaction_received':
      return '#f5a623'
```

Add cases to the `label` function inside `NotificationsClient`:

```typescript
      case 'connection_game_logged': {
        const leagueName = typeof n.meta?.leagueName === 'string' ? n.meta.leagueName : null
        const gameName = typeof n.meta?.gameName === 'string' ? n.meta.gameName : null
        return leagueName ? t('connectionGameLoggedNamed', { gameName, leagueName }) : t('connectionGameLogged')
      }
      case 'reaction_received': {
        const emoji = typeof n.meta?.emoji === 'string' ? n.meta.emoji : '✨'
        return t('reactionReceived', { emoji })
      }
```

- [ ] **Step 3: Mirror the changes in `NotificationBell.tsx`.**

Same additions to `hrefFor` and `notificationLabel` switches.

- [ ] **Step 4: Add i18n keys.**

In `messages/en/app.json` under `notifications`:

```json
"connectionGameLogged": "Someone in your league logged a game",
"connectionGameLoggedNamed": "New {gameName} game in {leagueName}",
"reactionReceived": "Someone reacted {emoji} on your game",
```

In `messages/nl/app.json` under `notifications`:

```json
"connectionGameLogged": "Iemand in jouw league heeft een partij gelogd",
"connectionGameLoggedNamed": "Nieuwe partij {gameName} in {leagueName}",
"reactionReceived": "Iemand heeft {emoji} op je partij gegeven",
```

- [ ] **Step 5: Extend the email-preferences helper to know about the two new types.**

In the file that defines `shouldSendEmailTo` (or equivalent), find the existing list of trigger keys (the file likely contains a string-union type or a `EmailTrigger` constant). Add `'connection_game_logged'` and `'reaction_received'` to that list. Update the defaults so both are `false` (opt-out by default — see spec §3.6).

Concrete change pattern (adapt to the actual file shape you find):

```typescript
const DEFAULTS: Record<EmailTrigger, boolean> = {
  // ...existing
  connection_game_logged: false,
  reaction_received: false,
}
```

- [ ] **Step 6: Add minimal email templates for the two types.**

In the email-templates file, add two new template functions matching the existing pattern. Each should produce a subject + plain-text body that reads naturally. Keep it short — the in-app notification carries the detail.

Example (adapt the function signature to match the file):

```typescript
case 'connection_game_logged':
  return {
    subject: t('email.connectionGameLogged.subject'),
    body: t('email.connectionGameLogged.body', { leagueName: meta.leagueName ?? '', actorEmail: meta.actorEmail ?? '' }),
  }
case 'reaction_received':
  return {
    subject: t('email.reactionReceived.subject', { emoji: meta.emoji ?? '' }),
    body: t('email.reactionReceived.body', { emoji: meta.emoji ?? '', actorEmail: meta.actorEmail ?? '' }),
  }
```

Add the corresponding email i18n keys in `messages/{en,nl}/emails.json` under whatever namespace matches existing email keys.

- [ ] **Step 7: Type-check + tests.**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: green. Existing tests touching the email/notification helpers may need their fixture updates if `EmailTrigger` widened.

- [ ] **Step 8: Commit.**

```bash
git add src/app/app/notifications src/components/layout/NotificationBell.tsx src/lib/email \
        messages/en messages/nl
git commit -m "feat(notifications): connection_game_logged + reaction_received types (email default off)"
```

---

## Task 14 — Batch `connection_game_logged` in `NotificationBell`

**Files:**
- Create: `src/lib/social/batchNotifications.ts`
- Create: `src/lib/social/batchNotifications.test.ts`
- Modify: `src/components/layout/NotificationBell.tsx`

- [ ] **Step 1: Write the failing test.**

Create `src/lib/social/batchNotifications.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { batchConnectionGameLogged, type RawNotification } from '@/lib/social/batchNotifications'

const make = (id: string, type: string, meta: Record<string, unknown>, createdAt: string, read = false): RawNotification => ({
  id, type, meta, read, createdAt,
})

describe('batchConnectionGameLogged', () => {
  it('leaves other types untouched', () => {
    const input = [make('a', 'connection_request', {}, '2026-05-19T10:00:00Z')]
    expect(batchConnectionGameLogged(input)).toEqual(input)
  })

  it('does not collapse a single connection_game_logged', () => {
    const input = [make('a', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X' }, '2026-05-19T10:00:00Z')]
    expect(batchConnectionGameLogged(input)).toEqual(input)
  })

  it('collapses 2+ same-league same-day into one synthetic row', () => {
    const input = [
      make('a', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X', playedGameId: 'g1' }, '2026-05-19T22:00:00Z'),
      make('b', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X', playedGameId: 'g2' }, '2026-05-19T10:00:00Z'),
      make('c', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X', playedGameId: 'g3' }, '2026-05-19T08:00:00Z'),
    ]
    const out = batchConnectionGameLogged(input)
    expect(out).toHaveLength(1)
    expect(out[0]?.type).toBe('connection_game_logged_batch')
    expect(out[0]?.meta).toMatchObject({ leagueId: 'l1', leagueName: 'X', count: 3, playedGameId: 'g1' })
  })

  it('does not merge across UTC days', () => {
    const input = [
      make('a', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X' }, '2026-05-19T22:00:00Z'),
      make('b', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X' }, '2026-05-20T01:00:00Z'),
    ]
    expect(batchConnectionGameLogged(input)).toEqual(input)
  })

  it('does not merge across different leagues', () => {
    const input = [
      make('a', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X' }, '2026-05-19T10:00:00Z'),
      make('b', 'connection_game_logged', { leagueId: 'l2', leagueName: 'Y' }, '2026-05-19T11:00:00Z'),
    ]
    expect(batchConnectionGameLogged(input)).toEqual(input)
  })
})
```

- [ ] **Step 2: Run, expect failure.**

Run: `npm test -- --run src/lib/social/batchNotifications.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.**

Create `src/lib/social/batchNotifications.ts`:

```typescript
export type RawNotification = {
  id: string
  type: string
  meta: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

function utcDay(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD in UTC
}

export function batchConnectionGameLogged(notifications: RawNotification[]): RawNotification[] {
  const out: RawNotification[] = []
  const groups = new Map<string, RawNotification[]>()

  for (const n of notifications) {
    if (n.type !== 'connection_game_logged') {
      // Flush any open groups first (preserving original order).
      out.push(n)
      continue
    }
    const leagueId = String((n.meta ?? {}).leagueId ?? '')
    const key = `${leagueId}|${utcDay(n.createdAt)}`
    const bucket = groups.get(key) ?? []
    bucket.push(n)
    groups.set(key, bucket)
  }

  for (const [, bucket] of groups) {
    if (bucket.length < 2) {
      out.push(...bucket)
      continue
    }
    // Use the most recent (first by createdAt desc — assume input order from query is already desc).
    const sorted = [...bucket].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const head = sorted[0]!
    out.push({
      id: `batch:${head.id}`,
      type: 'connection_game_logged_batch',
      meta: {
        ...(head.meta ?? {}),
        count: bucket.length,
        playedGameId: (head.meta ?? {}).playedGameId ?? null,
      },
      read: sorted.every(n => n.read),
      createdAt: head.createdAt,
    })
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
```

- [ ] **Step 4: Run, expect pass.**

Run: `npm test -- --run src/lib/social/batchNotifications.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire into `NotificationBell.tsx`.**

In `src/components/layout/NotificationBell.tsx`, import `batchConnectionGameLogged`, and inside the component apply it to `initialNotifications`:

```typescript
import { batchConnectionGameLogged } from '@/lib/social/batchNotifications'

// inside component, replace useState with the batched view:
const [notifications] = useState(() => batchConnectionGameLogged(initialNotifications))
```

Add a case to the `notificationLabel` switch in the same file:

```typescript
      case 'connection_game_logged_batch': {
        const count = Number((n.meta ?? {}).count ?? 0)
        const leagueName = typeof (n.meta ?? {}).leagueName === 'string' ? String((n.meta ?? {}).leagueName) : null
        return leagueName ? t('connectionGameLoggedBatch', { count, leagueName }) : t('connectionGameLogged')
      }
```

Add the case to `hrefFor` (same href shape as `connection_game_logged`):

```typescript
    case 'connection_game_logged_batch': {
      const playedGameId = typeof meta.playedGameId === 'string' ? meta.playedGameId : null
      return playedGameId ? `/app/profile?game=${playedGameId}` : '/app/profile'
    }
```

Add the corresponding i18n key in both `messages/{en,nl}/app.json` under `notifications`:

```json
"connectionGameLoggedBatch": "{count} new games in {leagueName}"
```

(Dutch: `"{count} nieuwe partijen in {leagueName}"`)

- [ ] **Step 6: Commit.**

```bash
git add src/lib/social/batchNotifications.ts src/lib/social/batchNotifications.test.ts \
        src/components/layout/NotificationBell.tsx messages/en/app.json messages/nl/app.json
git commit -m "feat(notifications): batch connection_game_logged by (leagueId, UTC-day) in bell"
```

---

## Task 15 — Fire `connection_game_logged` from approval transitions

**Files:**
- Locate: every site that sets `PlayedGame.status` to `'approved'` (initial creation paths AND admin/owner approvals).
- Modify: those sites to fire notifications.
- Optional: extract a `fireConnectionGameLogged(playedGameId)` helper to keep call sites tiny.

- [ ] **Step 1: Enumerate every approval transition.**

Use the Grep tool with pattern `status:\s*['"]approved['"]` over `src` (or `rg "status:\s*['\"]approved['\"]" src`). Also grep for `playedGame.create` and `playedGame.update` to catch transitions where the literal string isn't on the same line. Expected: hits in (a) any `prisma.playedGame.create` (default status is `'approved'` per `prisma/schema.prisma` line 132, so every create that doesn't override status counts), and (b) any update path that flips `pending → approved`.

Concrete paths to inspect (verify by reading; names may differ):
- `src/app/app/leagues/[id]/log/actions.ts` — owner direct log (creates with default `approved`)
- `src/app/app/leagues/[id]/log/actions.ts` or sibling — borrowed-league submission approval path
- Any admin approve/reject action

For each location: after the `prisma.playedGame.create` or successful `update → approved` transition, call the helper below.

- [ ] **Step 2: Create the helper.**

Create `src/lib/social/fireConnectionGameLogged.ts`:

```typescript
import { prisma } from '@/lib/prisma'

/**
 * Fire connection_game_logged notifications to every league member who was NOT
 * a participant in this game. Idempotent at the row level — caller is responsible
 * for only invoking this on actual status transitions to 'approved'.
 */
export async function fireConnectionGameLogged(playedGameId: string): Promise<void> {
  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId },
    select: {
      id: true,
      league: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          gameTemplate: { select: { name: true } },
          members: {
            select: { player: { select: { userId: true, linkedUserId: true } } },
          },
        },
      },
      scores: {
        select: { player: { select: { userId: true, linkedUserId: true } } },
      },
    },
  })
  if (!pg) return

  // Identify participants (any User behind a Player who scored in the game).
  const participantUserIds = new Set<string>()
  for (const s of pg.scores) {
    if (s.player.linkedUserId) participantUserIds.add(s.player.linkedUserId)
    else if (s.player.userId) participantUserIds.add(s.player.userId)
  }

  // Recipients: every distinct User reachable via league membership, MINUS participants.
  const recipientIds = new Set<string>()
  recipientIds.add(pg.league.ownerId)
  for (const m of pg.league.members) {
    if (m.player.linkedUserId) recipientIds.add(m.player.linkedUserId)
    else if (m.player.userId) recipientIds.add(m.player.userId)
  }
  for (const id of participantUserIds) recipientIds.delete(id)
  if (recipientIds.size === 0) return

  await prisma.notification.createMany({
    data: Array.from(recipientIds).map(userId => ({
      userId,
      type: 'connection_game_logged',
      meta: {
        playedGameId: pg.id,
        leagueId: pg.league.id,
        leagueName: pg.league.name,
        gameName: pg.league.gameTemplate.name,
      },
    })),
  })
}
```

- [ ] **Step 3: Add a test for the helper.**

Create `src/test/fire-connection-game-logged.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playedGame: { findUnique: vi.fn() },
    notification: { createMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { fireConnectionGameLogged } from '@/lib/social/fireConnectionGameLogged'

beforeEach(() => vi.clearAllMocks())

describe('fireConnectionGameLogged', () => {
  it('notifies league members who were not participants', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1',
      league: {
        id: 'l-1', name: 'Sundays', ownerId: 'owner',
        gameTemplate: { name: 'Risk' },
        members: [
          { player: { userId: 'owner', linkedUserId: null } },
          { player: { userId: 'someone', linkedUserId: 'friend-1' } },
          { player: { userId: 'someone', linkedUserId: 'friend-2' } },
        ],
      },
      scores: [
        { player: { userId: 'owner', linkedUserId: null } },
        { player: { userId: 'someone', linkedUserId: 'friend-1' } },
      ],
    } as never)
    vi.mocked(prisma.notification.createMany).mockResolvedValueOnce({ count: 1 } as never)

    await fireConnectionGameLogged('pg-1')

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'friend-2', type: 'connection_game_logged' }),
      ],
    })
  })

  it('no-ops when every member was a participant', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1',
      league: { id: 'l-1', name: 'X', ownerId: 'owner', gameTemplate: { name: 'Risk' }, members: [{ player: { userId: 'owner', linkedUserId: null } }] },
      scores: [{ player: { userId: 'owner', linkedUserId: null } }],
    } as never)
    await fireConnectionGameLogged('pg-1')
    expect(prisma.notification.createMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run the test.**

Run: `npm test -- --run src/test/fire-connection-game-logged.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Call `fireConnectionGameLogged` at every approval site identified in Step 1.**

At each site, after `prisma.playedGame.create({ ... })` returns:

```typescript
import { fireConnectionGameLogged } from '@/lib/social/fireConnectionGameLogged'

const created = await prisma.playedGame.create({ ... })
await fireConnectionGameLogged(created.id)
```

At each `pending → approved` update site:

```typescript
const updated = await prisma.playedGame.update({ where: { id }, data: { status: 'approved' } })
await fireConnectionGameLogged(updated.id)
```

Do **not** call it from the `pending` creation (borrowed-league submission) — only fires on the approval.

- [ ] **Step 6: Verify nothing broke.**

Run: `npm test -- --run && npx tsc --noEmit`
Expected: green.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/social/fireConnectionGameLogged.ts src/test/fire-connection-game-logged.test.ts \
        src/app/app/leagues
git commit -m "feat(social): fire connection_game_logged from every approval transition"
```

---

## Task 16 — Landing page + README copy

**Files:**
- Modify: `src/app/[locale]/(marketing)/page.tsx`
- Modify: `messages/en/landing.json` + `messages/nl/landing.json` (for any new strings)
- Modify: `README.md`

- [ ] **Step 1: Read the existing marketing page.**

Open `src/app/[locale]/(marketing)/page.tsx` and identify the feature-list section. Match its visual + i18n pattern.

- [ ] **Step 2: Add the new features as a section.**

Add a section listing what Plan A ships:
- Activity feed on your profile
- React to your friends' games with five emoji
- Public profile at `dicevault.fun/u/<username>` with three privacy levels

Add the i18n keys under whatever namespace the page uses (likely `landing.features.*`).

> If Plan B has already shipped at the time you ship Plan A, this is the holistic sweep — also mention family shared credits.

- [ ] **Step 3: Update README.**

Add a single bullet under the features list:

```markdown
- **Social layer:** personal activity feed, emoji reactions on games, opt-in public profiles at `/u/<username>`.
```

- [ ] **Step 4: Visual check.**

Run: `npm run dev`. Visit `/en` and `/nl`. Confirm the new feature section renders correctly in both locales.

- [ ] **Step 5: Commit.**

```bash
git add src/app/[locale]/\(marketing\) messages/en/landing.json messages/nl/landing.json README.md
git commit -m "docs(landing): announce social layer (feed, reactions, public profile)"
```

---

## Post-flight

- [ ] **Run the full test suite.**

Run: `npm test -- --run`
Expected: all green.

- [ ] **Type-check.**

Run: `npx tsc --noEmit`
Expected: no errors. (Per project memory, `next.config.ts` skips TS checks at build time to avoid Coolify OOM — `tsc --noEmit` is the local gate.)

- [ ] **Smoke-test the full social flow in dev.**

Manually:
1. Log in as user A. Visit `/app/profile`. Identity card shows, feed shows your games.
2. Open a game's scorecard, react with 🔥. Reload — reaction persists.
3. Log in as user B who shares a league with A. Visit `/app/profile`. User A's recent game appears. React with 👏. Open `/app/notifications` as A — see `reaction_received`.
4. Log in as A. Create a new game in a shared league. Log in as B, expect `connection_game_logged` in the bell.
5. Toggle privacy on /app/settings → enable, choose Full, allowAppearInOthers off. Visit `/en/u/<a-username>` as anonymous browser. Hero + trophies + feed; user A's own name renders; opponents who opted out show as "Speler A/B".
6. Toggle privacy back to private. Hit the same URL — generic 404.

- [ ] **Update `docs/superpowers/plans/INDEX.md`.**

Add a row above the parked phases:

```markdown
| **A** | [plan-a-social-layer.md](2026-05-19-plan-a-social-layer.md) | done | Feed + reactions + public profile + privacy |
```

Commit:

```bash
git add docs/superpowers/plans/INDEX.md
git commit -m "docs(plans): mark Plan A done in INDEX"
```

- [ ] **Push.**

Per project memory (`feedback_no_prs.md`): merge + push to main directly, no PR.

Run: `git push origin main`
Expected: success. Coolify auto-deploys on push.
