# Group & Social Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Leagues (persistent recurring game groups), PlayedGame logging with approval flow, vault keeper connections, shared vault UI, and in-app notifications — the USP of Dice Vault.

**Architecture:** Linked-records approach — Leagues and GameTemplates live in the owner's vault; connected vault keepers access them via `Player.linkedUserId` + `LeagueMember` join records. No data duplication. Three phases: Phase 2 builds the League/PlayedGame core; Phase 3 adds connections, shared UI, and notifications; Phase 4 adds email notifications and admin approval views.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 5, PostgreSQL, ioredis, Vitest, shadcn/ui, Tailwind v3, next-intl, qrcode (npm), Zod

**Spec:** `docs/superpowers/specs/2026-04-17-group-social-features-design.md`

---

## File map

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Add League, LeagueMember, PlayedGame (renamed Session), ScoreEntry update, Player update, ConnectionRequest, VaultConnection, Notification |
| `src/lib/credits.ts` | Updated action keys: `cost_game_template` 25, `cost_league` 10, `cost_add_player` 10, `cost_played_game` 5 |
| `src/lib/leagues.ts` | createLeague, getLeagues, getLeague, deleteLeague, addMember, removeMember |
| `src/lib/leagues.test.ts` | Tests for all league functions |
| `src/lib/played-games.ts` | createPlayedGame, approvePlayedGame, rejectPlayedGame, getPlayedGames |
| `src/lib/played-games.test.ts` | Tests |
| `src/lib/connections.ts` | sendConnectionRequest, acceptRequest, declineRequest, disconnect |
| `src/lib/connections.test.ts` | Tests |
| `src/lib/notifications.ts` | createNotification, getNotifications, markRead |
| `src/lib/notifications.test.ts` | Tests |
| `src/components/shared/SharedRibbon.tsx` | "[Owner]'s VAULT" corner ribbon for shared cards |
| `src/components/shared/NotificationBell.tsx` | Bell icon with unread count + dropdown |
| `src/components/shared/QRCode.tsx` | QR code display using `qrcode` library |
| `src/app/app/leagues/page.tsx` | League list (owned + shared) |
| `src/app/app/leagues/new/page.tsx` | League creation wizard |
| `src/app/app/leagues/[id]/page.tsx` | League detail + played games |
| `src/app/app/leagues/[id]/played-games/new/page.tsx` | Log a played game |
| `src/app/app/leagues/[id]/played-games/[pgId]/approve/page.tsx` | Owner accept/reject page |
| `src/app/app/players/page.tsx` | Updated: vault keeper connection UI |
| `src/app/app/settings/page.tsx` | Updated: QR code section |
| `src/app/api/leagues/route.ts` | GET /api/leagues, POST /api/leagues |
| `src/app/api/leagues/[id]/route.ts` | GET, DELETE |
| `src/app/api/leagues/[id]/members/route.ts` | POST (add), DELETE (remove) |
| `src/app/api/leagues/[id]/played-games/route.ts` | GET, POST |
| `src/app/api/leagues/[id]/played-games/[pgId]/route.ts` | PATCH (approve/reject) |
| `src/app/api/connections/route.ts` | GET (list), POST (send request) |
| `src/app/api/connections/[id]/route.ts` | PATCH (accept/decline) |
| `src/app/api/connections/disconnect/route.ts` | POST (disconnect vault keeper) |
| `src/app/api/notifications/route.ts` | GET (list), PATCH (mark all read) |

---

## Phase 2 — League + PlayedGame core

---

## Task 1: Update Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace the full schema**

Open `prisma/schema.prisma` and replace its contents with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  passwordHash        String
  emailVerified       DateTime?
  locale              String    @default("en")
  role                String    @default("user")

  totpSecret          String?
  totpEnabled         Boolean   @default(false)
  totpBackupCodes     String[]
  requiresMfa         Boolean   @default(false)

  credits             Int       @default(75)
  isLifetimeFree      Boolean   @default(false)

  players             Player[]
  linkedAsPlayer      Player[]            @relation("LinkedPlayer")
  gameTemplates       GameTemplate[]
  ownedLeagues        League[]            @relation("OwnedLeagues")
  playedGames         PlayedGame[]        @relation("SubmittedPlayedGames")
  creditTransactions  CreditTransaction[]
  creditPurchases     CreditPurchase[]
  connectionsSent     ConnectionRequest[] @relation("SentRequests")
  connectionsReceived ConnectionRequest[] @relation("ReceivedRequests")
  vaultConnections    VaultConnection[]   @relation("MyConnections")
  connectedToMe       VaultConnection[]   @relation("ConnectedToMe")
  notifications       Notification[]

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

model Player {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  avatarSeed    String
  linkedUserId  String?
  linkedUser    User?          @relation("LinkedPlayer", fields: [linkedUserId], references: [id], onDelete: SetNull)
  scores        ScoreEntry[]
  leagueMembers LeagueMember[]
  createdAt     DateTime       @default(now())
}

model GameTemplate {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  description  String?
  scoringNotes String?
  leagues      League[]
  createdAt    DateTime @default(now())
}

model League {
  id                 String              @id @default(cuid())
  ownerId            String
  owner              User                @relation("OwnedLeagues", fields: [ownerId], references: [id], onDelete: Cascade)
  gameTemplateId     String
  gameTemplate       GameTemplate        @relation(fields: [gameTemplateId], references: [id])
  name               String
  description        String?
  members            LeagueMember[]
  playedGames        PlayedGame[]
  connectionRequests ConnectionRequest[]
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
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
  status        String       @default("approved")
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

model CreditTransaction {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  delta     Int
  reason    String   // "monthly_reset" | "game_template" | "league" | "add_player" | "played_game" | "admin_adjustment" | "purchase"
  meta      Json?
  createdAt DateTime @default(now())
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
}

model PricingRegion {
  id        String           @id @default(cuid())
  name      String
  currency  String
  symbol    String
  locales   String[]
  provider  String           @default("stripe")
  packs     Json
  isDefault Boolean          @default(false)
  active    Boolean          @default(true)
  order     Int              @default(0)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
  purchases CreditPurchase[]
}

model DiscountCode {
  id         String    @id @default(cuid())
  code       String    @unique
  type       String
  value      Int
  usageLimit Int?
  usedCount  Int       @default(0)
  expiresAt  DateTime?
  active     Boolean   @default(true)
  createdAt  DateTime  @default(now())
}

model Page {
  id        String   @id @default(cuid())
  slug      String   @unique
  isSystem  Boolean  @default(false)
  titleNl   String
  titleEn   String
  contentNl String   @db.Text
  contentEn String   @db.Text
  published Boolean  @default(true)
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AdminSettings {
  key   String @id
  value Json
}

model Review {
  id                String   @id @default(cuid())
  name              String
  review            String
  favoriteBoardGame String
  visible           Boolean  @default(true)
  order             Int      @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model ConnectionRequest {
  id          String   @id @default(cuid())
  fromUserId  String
  fromUser    User     @relation("SentRequests", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUserId    String?
  toUser      User?    @relation("ReceivedRequests", fields: [toUserId], references: [id], onDelete: Cascade)
  toEmail     String?
  inviteToken String?  @unique
  context     String
  leagueId    String?
  league      League?  @relation(fields: [leagueId], references: [id], onDelete: SetNull)
  status      String   @default("pending")
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
  type      String
  meta      Json?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name group-social-features
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add group social features schema (League, PlayedGame, connections, notifications)"
```

---

## Task 2: Update credit system

**Files:**
- Modify: `src/lib/credits.ts`
- Modify: `src/lib/credits.test.ts` (update cost keys)

> This task assumes `src/lib/credits.ts` exists from Phase 2 base work. If it doesn't exist yet, create it with the full content below.

- [ ] **Step 1: Write failing test**

Create or open `src/lib/credits.test.ts` and add:

```ts
import { describe, it, expect, vi } from 'vitest'

describe('credit action costs', () => {
  it('resolves game_template cost as 25', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValueOnce({
      key: 'cost_game_template', value: 25,
    })
    const { getActionCost } = await import('@/lib/credits')
    expect(await getActionCost('game_template')).toBe(25)
  })

  it('resolves league cost as 10', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValueOnce({
      key: 'cost_league', value: 10,
    })
    const { getActionCost } = await import('@/lib/credits')
    expect(await getActionCost('league')).toBe(10)
  })

  it('resolves add_player cost as 10', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValueOnce({
      key: 'cost_add_player', value: 10,
    })
    const { getActionCost } = await import('@/lib/credits')
    expect(await getActionCost('add_player')).toBe(10)
  })

  it('resolves played_game cost as 5', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValueOnce({
      key: 'cost_played_game', value: 5,
    })
    const { getActionCost } = await import('@/lib/credits')
    expect(await getActionCost('played_game')).toBe(5)
  })
})
```

- [ ] **Step 2: Update `src/test/setup.ts` to mock `adminSettings.findUnique`**

Add to the Prisma mock in `src/test/setup.ts`:

```ts
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
      user: { update: vi.fn() },
      creditTransaction: { create: vi.fn() },
    })),
    adminSettings: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    creditTransaction: { create: vi.fn() },
    league: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    leagueMember: { create: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    playedGame: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    scoreEntry: { createMany: vi.fn() },
    connectionRequest: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    vaultConnection: { create: vi.fn(), delete: vi.fn() },
    notification: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    player: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  },
}))
```

- [ ] **Step 3: Run tests — should fail**

```bash
npm test src/lib/credits.test.ts
```

Expected: FAIL — `getActionCost is not a function` (or similar)

- [ ] **Step 4: Create / update `src/lib/credits.ts`**

```ts
import { prisma } from '@/lib/prisma'

export type CreditAction = 'game_template' | 'league' | 'add_player' | 'played_game'

const COST_DEFAULTS: Record<CreditAction, number> = {
  game_template: 25,
  league: 10,
  add_player: 10,
  played_game: 5,
}

export async function getActionCost(action: CreditAction): Promise<number> {
  const row = await prisma.adminSettings.findUnique({ where: { key: `cost_${action}` } })
  return typeof row?.value === 'number' ? row.value : COST_DEFAULTS[action]
}

export class InsufficientCreditsError extends Error {
  constructor() { super('errors.insufficient_credits') }
}

export async function deductCredits(
  userId: string,
  action: CreditAction,
  meta?: Record<string, unknown>
): Promise<{ newBalance: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true, isLifetimeFree: true } })
  if (!user) throw new Error('User not found')
  if (user.isLifetimeFree) return { newBalance: user.credits }

  const cost = await getActionCost(action)
  if (user.credits < cost) throw new InsufficientCreditsError()

  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { credits: { decrement: cost } } }),
    prisma.creditTransaction.create({ data: { userId, delta: -cost, reason: action, meta } }),
  ])

  return { newBalance: updated.credits }
}
```

- [ ] **Step 5: Run tests — should pass**

```bash
npm test src/lib/credits.test.ts
```

Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/credits.ts src/lib/credits.test.ts src/test/setup.ts
git commit -m "feat: update credit system for group feature action costs"
```

---

## Task 3: League business logic

**Files:**
- Create: `src/lib/leagues.ts`
- Create: `src/lib/leagues.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/leagues.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

beforeEach(() => vi.clearAllMocks())

describe('createLeague', () => {
  it('deducts 10 credits and creates league + members', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'cost_league', value: 10 })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ credits: 50, isLifetimeFree: false } as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ credits: 40 }, {}])
    vi.mocked(prisma.league.create).mockResolvedValue({ id: 'league-1', name: 'Catan League' } as never)

    const { createLeague } = await import('@/lib/leagues')
    const result = await createLeague('user-1', {
      name: 'Catan League',
      gameTemplateId: 'template-1',
      playerIds: ['player-1', 'player-2'],
    })

    expect(result.id).toBe('league-1')
    expect(prisma.league.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Catan League', ownerId: 'user-1' }) })
    )
  })

  it('throws InsufficientCreditsError when credits < 10', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'cost_league', value: 10 })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ credits: 5, isLifetimeFree: false } as never)

    const { createLeague } = await import('@/lib/leagues')
    const { InsufficientCreditsError } = await import('@/lib/credits')
    await expect(createLeague('user-1', { name: 'x', gameTemplateId: 't', playerIds: [] }))
      .rejects.toThrow(InsufficientCreditsError)
  })
})

describe('getLeaguesForUser', () => {
  it('returns owned leagues and leagues the user is a member of', async () => {
    vi.mocked(prisma.league.findMany).mockResolvedValue([{ id: 'l1', ownerId: 'user-1' }] as never)

    const { getLeaguesForUser } = await import('@/lib/leagues')
    const result = await getLeaguesForUser('user-1')
    expect(result).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm test src/lib/leagues.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/leagues'`

- [ ] **Step 3: Create `src/lib/leagues.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { deductCredits } from '@/lib/credits'

interface CreateLeagueInput {
  name: string
  gameTemplateId: string
  playerIds: string[]
  description?: string
}

export async function createLeague(userId: string, input: CreateLeagueInput) {
  await deductCredits(userId, 'league', { name: input.name })

  return prisma.league.create({
    data: {
      ownerId: userId,
      gameTemplateId: input.gameTemplateId,
      name: input.name,
      description: input.description,
      members: {
        create: input.playerIds.map((playerId) => ({ playerId })),
      },
    },
    include: { members: true, gameTemplate: true },
  })
}

export async function getLeaguesForUser(userId: string) {
  return prisma.league.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { player: { linkedUserId: userId } } } },
      ],
    },
    include: { owner: { select: { id: true, email: true } }, gameTemplate: true, members: { include: { player: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getLeague(leagueId: string, userId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      owner: { select: { id: true, email: true } },
      gameTemplate: true,
      members: { include: { player: { include: { linkedUser: { select: { id: true, email: true } } } } } },
      playedGames: { where: { status: 'approved' }, orderBy: { playedAt: 'desc' }, include: { scores: { include: { player: true } } } },
    },
  })
}

export async function deleteLeague(leagueId: string, userId: string) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.ownerId !== userId) throw new Error('errors.not_found')
  return prisma.league.delete({ where: { id: leagueId } })
}

export async function addLeagueMember(leagueId: string, playerId: string, ownerId: string) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.ownerId !== ownerId) throw new Error('errors.not_found')
  return prisma.leagueMember.create({ data: { leagueId, playerId } })
}

export async function removeLeagueMember(leagueId: string, playerId: string, ownerId: string) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.ownerId !== ownerId) throw new Error('errors.not_found')
  return prisma.leagueMember.delete({ where: { leagueId_playerId: { leagueId, playerId } } })
}
```

- [ ] **Step 4: Run — should pass**

```bash
npm test src/lib/leagues.test.ts
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/leagues.ts src/lib/leagues.test.ts
git commit -m "feat: add league business logic"
```

---

## Task 4: PlayedGame business logic

**Files:**
- Create: `src/lib/played-games.ts`
- Create: `src/lib/played-games.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/played-games.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

beforeEach(() => vi.clearAllMocks())

describe('createPlayedGame', () => {
  it('sets status approved when submitter is league owner', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'cost_played_game', value: 5 })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ credits: 50, isLifetimeFree: false } as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ credits: 45 }, {}])
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'l1', ownerId: 'user-1' } as never)
    vi.mocked(prisma.playedGame.create).mockResolvedValue({ id: 'pg1', status: 'approved' } as never)

    const { createPlayedGame } = await import('@/lib/played-games')
    const result = await createPlayedGame('user-1', {
      leagueId: 'l1',
      playedAt: new Date('2026-04-17'),
      scores: [{ playerId: 'p1', score: 42 }],
    })
    expect(result.status).toBe('approved')
  })

  it('sets status pending_approval when submitter is not the owner', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'cost_played_game', value: 5 })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ credits: 50, isLifetimeFree: false } as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ credits: 45 }, {}])
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'l1', ownerId: 'owner-1' } as never)
    vi.mocked(prisma.playedGame.create).mockResolvedValue({ id: 'pg2', status: 'pending_approval' } as never)

    const { createPlayedGame } = await import('@/lib/played-games')
    const result = await createPlayedGame('user-2', {
      leagueId: 'l1',
      playedAt: new Date('2026-04-17'),
      scores: [{ playerId: 'p1', score: 10 }],
    })
    expect(result.status).toBe('pending_approval')
  })
})

describe('approvePlayedGame', () => {
  it('sets status to approved', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1', status: 'pending_approval', league: { ownerId: 'user-1' },
    } as never)
    vi.mocked(prisma.playedGame.update).mockResolvedValue({ id: 'pg1', status: 'approved' } as never)

    const { approvePlayedGame } = await import('@/lib/played-games')
    const result = await approvePlayedGame('pg1', 'user-1')
    expect(result.status).toBe('approved')
  })
})

describe('rejectPlayedGame', () => {
  it('sets status to rejected', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1', status: 'pending_approval', league: { ownerId: 'user-1' },
    } as never)
    vi.mocked(prisma.playedGame.update).mockResolvedValue({ id: 'pg1', status: 'rejected' } as never)

    const { rejectPlayedGame } = await import('@/lib/played-games')
    const result = await rejectPlayedGame('pg1', 'user-1')
    expect(result.status).toBe('rejected')
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm test src/lib/played-games.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/played-games'`

- [ ] **Step 3: Create `src/lib/played-games.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { deductCredits } from '@/lib/credits'

interface CreatePlayedGameInput {
  leagueId: string
  playedAt: Date
  notes?: string
  scores: { playerId: string; score: number }[]
}

export async function createPlayedGame(userId: string, input: CreatePlayedGameInput) {
  const league = await prisma.league.findUnique({ where: { id: input.leagueId } })
  if (!league) throw new Error('errors.not_found')

  await deductCredits(userId, 'played_game', { leagueId: input.leagueId })

  const status = league.ownerId === userId ? 'approved' : 'pending_approval'

  return prisma.playedGame.create({
    data: {
      leagueId: input.leagueId,
      submittedById: userId,
      playedAt: input.playedAt,
      notes: input.notes,
      status,
      scores: { create: input.scores },
    },
    include: { scores: { include: { player: true } } },
  })
}

export async function approvePlayedGame(playedGameId: string, userId: string) {
  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId },
    include: { league: true },
  })
  if (!pg || pg.league.ownerId !== userId) throw new Error('errors.not_found')
  if (pg.status !== 'pending_approval') throw new Error('errors.invalid_status')

  return prisma.playedGame.update({ where: { id: playedGameId }, data: { status: 'approved' } })
}

export async function rejectPlayedGame(playedGameId: string, userId: string) {
  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId },
    include: { league: true },
  })
  if (!pg || pg.league.ownerId !== userId) throw new Error('errors.not_found')
  if (pg.status !== 'pending_approval') throw new Error('errors.invalid_status')

  return prisma.playedGame.update({ where: { id: playedGameId }, data: { status: 'rejected' } })
}

export async function getPlayedGames(leagueId: string, userId: string) {
  return prisma.playedGame.findMany({
    where: {
      leagueId,
      OR: [{ status: 'approved' }, { submittedById: userId }],
    },
    include: { scores: { include: { player: true } }, submittedBy: { select: { id: true, email: true } } },
    orderBy: { playedAt: 'desc' },
  })
}
```

- [ ] **Step 4: Run — should pass**

```bash
npm test src/lib/played-games.test.ts
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/played-games.ts src/lib/played-games.test.ts
git commit -m "feat: add played game business logic with approval flow"
```

---

## Task 5: League API routes

**Files:**
- Create: `src/app/api/leagues/route.ts`
- Create: `src/app/api/leagues/[id]/route.ts`
- Create: `src/app/api/leagues/[id]/members/route.ts`
- Create: `src/app/api/leagues/[id]/played-games/route.ts`
- Create: `src/app/api/leagues/[id]/played-games/[pgId]/route.ts`

> These routes use NextAuth v5 `auth()` to get the session. Import it from `@/lib/auth`.

- [ ] **Step 1: Create `src/app/api/leagues/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getLeaguesForUser, createLeague } from '@/lib/leagues'
import { InsufficientCreditsError } from '@/lib/credits'
import { z } from 'zod'

const CreateLeagueSchema = z.object({
  name: z.string().min(1).max(100),
  gameTemplateId: z.string().cuid(),
  playerIds: z.array(z.string().cuid()),
  description: z.string().max(500).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const leagues = await getLeaguesForUser(session.user.id)
  return NextResponse.json(leagues)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateLeagueSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'errors.invalid_form' }, { status: 400 })

  try {
    const league = await createLeague(session.user.id, parsed.data)
    return NextResponse.json(league, { status: 201 })
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: e.message }, { status: 402 })
    throw e
  }
}
```

- [ ] **Step 2: Create `src/app/api/leagues/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getLeague, deleteLeague } from '@/lib/leagues'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { id } = await params
  const league = await getLeague(id, session.user.id)
  if (!league) return NextResponse.json({ error: 'errors.not_found' }, { status: 404 })
  return NextResponse.json(league)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    await deleteLeague(id, session.user.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'errors.not_found' }, { status: 404 })
  }
}
```

- [ ] **Step 3: Create `src/app/api/leagues/[id]/members/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { addLeagueMember, removeLeagueMember } from '@/lib/leagues'
import { z } from 'zod'

const MemberSchema = z.object({ playerId: z.string().cuid() })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = MemberSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'errors.invalid_form' }, { status: 400 })
  const member = await addLeagueMember(id, parsed.data.playerId, session.user.id)
  return NextResponse.json(member, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = MemberSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'errors.invalid_form' }, { status: 400 })
  await removeLeagueMember(id, parsed.data.playerId, session.user.id)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Create `src/app/api/leagues/[id]/played-games/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createPlayedGame, getPlayedGames } from '@/lib/played-games'
import { InsufficientCreditsError } from '@/lib/credits'
import { z } from 'zod'

const CreatePlayedGameSchema = z.object({
  playedAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
  scores: z.array(z.object({ playerId: z.string().cuid(), score: z.number().int() })).min(1),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { id } = await params
  const games = await getPlayedGames(id, session.user.id)
  return NextResponse.json(games)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = CreatePlayedGameSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'errors.invalid_form' }, { status: 400 })

  try {
    const pg = await createPlayedGame(session.user.id, { ...parsed.data, leagueId: id, playedAt: new Date(parsed.data.playedAt) })
    return NextResponse.json(pg, { status: 201 })
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: e.message }, { status: 402 })
    throw e
  }
}
```

- [ ] **Step 5: Create `src/app/api/leagues/[id]/played-games/[pgId]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { approvePlayedGame, rejectPlayedGame } from '@/lib/played-games'
import { z } from 'zod'

const PatchSchema = z.object({ action: z.enum(['approve', 'reject']) })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; pgId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { pgId } = await params
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'errors.invalid_form' }, { status: 400 })

  try {
    const result = parsed.data.action === 'approve'
      ? await approvePlayedGame(pgId, session.user.id)
      : await rejectPlayedGame(pgId, session.user.id)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'errors.not_found' }, { status: 404 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/leagues/
git commit -m "feat: add league and played game API routes"
```

---

## Task 6: League UI — list + creation wizard

**Files:**
- Create: `src/app/app/leagues/page.tsx`
- Create: `src/app/app/leagues/new/page.tsx`
- Create: `src/components/league/LeagueCard.tsx`

- [ ] **Step 1: Create `src/components/league/LeagueCard.tsx`**

```tsx
import { cn } from '@/lib/utils'

interface LeagueCardProps {
  id: string
  name: string
  gameName: string
  memberCount: number
  ownerEmail?: string
  isShared: boolean
  onClick: () => void
}

export function LeagueCard({ id, name, gameName, memberCount, ownerEmail, isShared, onClick }: LeagueCardProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-full text-left bg-surface-container-lowest rounded-xl p-4 border border-outline-variant hover:border-primary transition-colors overflow-hidden"
    >
      {isShared && ownerEmail && (
        <span className="absolute top-0 right-0 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-bl-lg tracking-wide">
          {ownerEmail.split('@')[0].toUpperCase()}&apos;S VAULT
        </span>
      )}
      <p className={cn('font-headline font-bold text-on-surface text-base', isShared && 'mt-4')}>{name}</p>
      <p className="text-sm text-on-surface-variant mt-1">{gameName} · {memberCount} players</p>
    </button>
  )
}
```

- [ ] **Step 2: Create `src/app/app/leagues/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLeaguesForUser } from '@/lib/leagues'
import { LeagueCard } from '@/components/league/LeagueCard'
import Link from 'next/link'

export default async function LeaguesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/en/auth/login')

  const leagues = await getLeaguesForUser(session.user.id)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-bold text-2xl text-on-surface">Leagues</h1>
        <Link
          href="/app/leagues/new"
          className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dim transition-colors"
        >
          New League
        </Link>
      </div>

      {leagues.length === 0 && (
        <p className="text-on-surface-variant text-sm">No leagues yet. Create one to start tracking scores.</p>
      )}

      <div className="grid gap-3">
        {leagues.map((league) => (
          <LeagueCard
            key={league.id}
            id={league.id}
            name={league.name}
            gameName={league.gameTemplate.name}
            memberCount={league.members.length}
            ownerEmail={league.owner.email}
            isShared={league.ownerId !== session.user.id}
            onClick={() => {}}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/app/leagues/new/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewLeaguePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [gameTemplateId, setGameTemplateId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, gameTemplateId, playerIds: [] }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'errors.server_error')
      setLoading(false)
      return
    }

    const league = await res.json()
    router.push(`/app/leagues/${league.id}`)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="font-headline font-bold text-2xl text-on-surface mb-6">New League</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary"
            placeholder="Wednesday Catan"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Game Template ID</label>
          <input
            value={gameTemplateId}
            onChange={(e) => setGameTemplateId(e.target.value)}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary"
            placeholder="(paste game template ID)"
            required
          />
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-on-primary py-2 rounded-lg font-medium hover:bg-primary-dim disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating…' : 'Create League (10 credits)'}
        </button>
      </form>
    </div>
  )
}
```

> Note: The game template selector will be replaced with a proper dropdown in a later UI polish pass when the GameTemplate list API is available.

- [ ] **Step 4: Commit**

```bash
git add src/components/league/ src/app/app/leagues/
git commit -m "feat: add league list and creation pages"
```

---

## Task 7: League detail + played game form

**Files:**
- Create: `src/app/app/leagues/[id]/page.tsx`
- Create: `src/app/app/leagues/[id]/played-games/new/page.tsx`

- [ ] **Step 1: Create `src/app/app/leagues/[id]/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLeague } from '@/lib/leagues'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/en/auth/login')
  const { id } = await params

  const league = await getLeague(id, session.user.id)
  if (!league) notFound()

  const isOwner = league.ownerId === session.user.id
  const isShared = !isOwner

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="relative mb-6">
        {isShared && (
          <span className="absolute top-0 right-0 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-bl-lg tracking-wide">
            {league.owner.email.split('@')[0].toUpperCase()}&apos;S VAULT
          </span>
        )}
        <h1 className={`font-headline font-bold text-2xl text-on-surface ${isShared ? 'mt-6' : ''}`}>
          {league.name}
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">{league.gameTemplate.name}</p>
      </div>

      <section className="mb-6">
        <h2 className="font-headline font-semibold text-lg mb-3">Members</h2>
        <div className="flex flex-wrap gap-2">
          {league.members.map((m) => (
            <span key={m.id} className="bg-secondary-container text-on-surface px-3 py-1 rounded-full text-sm">
              {m.player.name}
              {m.player.linkedUser && ' 🔗'}
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline font-semibold text-lg">Played Games</h2>
          <Link
            href={`/app/leagues/${id}/played-games/new`}
            className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-dim transition-colors"
          >
            Log Game (5 credits)
          </Link>
        </div>

        {league.playedGames.length === 0 && (
          <p className="text-on-surface-variant text-sm">No games logged yet.</p>
        )}

        <div className="space-y-3">
          {league.playedGames.map((pg) => (
            <div key={pg.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
              <p className="text-sm font-medium text-on-surface">
                {new Date(pg.playedAt).toLocaleDateString()}
              </p>
              <div className="mt-2 space-y-1">
                {pg.scores
                  .sort((a, b) => b.score - a.score)
                  .map((s, i) => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">{i + 1}. {s.player.name}</span>
                      <span className="font-medium text-on-surface">{s.score}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/app/leagues/[id]/played-games/new/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Score { playerId: string; playerName: string; score: string }

export default function NewPlayedGamePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [scores, setScores] = useState<Score[]>([{ playerId: '', playerName: '', score: '' }])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function addScore() {
    setScores((prev) => [...prev, { playerId: '', playerName: '', score: '' }])
  }

  function updateScore(index: number, field: keyof Score, value: string) {
    setScores((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/leagues/${id}/played-games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playedAt: new Date(playedAt).toISOString(),
        notes: notes || undefined,
        scores: scores.map((s) => ({ playerId: s.playerId, score: parseInt(s.score, 10) })),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'errors.server_error')
      setLoading(false)
      return
    }

    router.push(`/app/leagues/${id}`)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="font-headline font-bold text-2xl text-on-surface mb-6">Log Played Game</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Date played</label>
          <input
            type="date"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:outline-none focus:border-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Scores</label>
          {scores.map((s, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                placeholder="Player ID"
                value={s.playerId}
                onChange={(e) => updateScore(i, 'playerId', e.target.value)}
                className="flex-1 border border-outline-variant rounded-lg px-3 py-2 text-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
              <input
                type="number"
                placeholder="Score"
                value={s.score}
                onChange={(e) => updateScore(i, 'score', e.target.value)}
                className="w-24 border border-outline-variant rounded-lg px-3 py-2 text-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
          ))}
          <button type="button" onClick={addScore} className="text-primary text-sm font-medium">
            + Add player
          </button>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-on-primary py-2 rounded-lg font-medium hover:bg-primary-dim disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving…' : 'Log Game (5 credits)'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/leagues/
git commit -m "feat: add league detail and played game logging pages"
```

---

## Phase 3 — Connections, shared vault UI, notifications

---

## Task 8: Connection business logic

**Files:**
- Create: `src/lib/connections.ts`
- Create: `src/lib/connections.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/connections.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

beforeEach(() => vi.clearAllMocks())

describe('sendConnectionRequest', () => {
  it('deducts add_player credits and creates request', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'cost_add_player', value: 10 })
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ credits: 50, isLifetimeFree: false } as never) // deductCredits
      .mockResolvedValueOnce({ id: 'user-b' } as never) // findByEmail

    vi.mocked(prisma.$transaction).mockResolvedValue([{ credits: 40 }, {}])
    vi.mocked(prisma.connectionRequest.create).mockResolvedValue({ id: 'req-1', status: 'pending' } as never)

    const { sendConnectionRequest } = await import('@/lib/connections')
    const result = await sendConnectionRequest('user-a', { toEmail: 'b@example.com', context: 'player_list' })
    expect(result.status).toBe('pending')
  })

  it('throws if sending to yourself', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-a' } as never)
    const { sendConnectionRequest } = await import('@/lib/connections')
    await expect(sendConnectionRequest('user-a', { toEmail: 'a@example.com', context: 'player_list' }))
      .rejects.toThrow('errors.cannot_connect_self')
  })
})

describe('acceptConnectionRequest', () => {
  it('creates VaultConnection and sets linkedUserId on Player', async () => {
    vi.mocked(prisma.connectionRequest.findUnique).mockResolvedValue({
      id: 'req-1', fromUserId: 'user-a', toUserId: 'user-b', status: 'pending', context: 'player_list', leagueId: null,
    } as never)
    vi.mocked(prisma.vaultConnection.create).mockResolvedValue({} as never)
    vi.mocked(prisma.player.findFirst).mockResolvedValue({ id: 'player-1' } as never)
    vi.mocked(prisma.player.update).mockResolvedValue({} as never)
    vi.mocked(prisma.connectionRequest.update).mockResolvedValue({ status: 'accepted' } as never)

    const { acceptConnectionRequest } = await import('@/lib/connections')
    await acceptConnectionRequest('req-1', 'user-b')

    expect(prisma.vaultConnection.create).toHaveBeenCalledTimes(2)
    expect(prisma.player.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { linkedUserId: 'user-b' } })
    )
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm test src/lib/connections.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/connections'`

- [ ] **Step 3: Create `src/lib/connections.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { deductCredits } from '@/lib/credits'
import { createNotification } from '@/lib/notifications'
import crypto from 'crypto'

interface SendRequestInput {
  toEmail: string
  context: 'player_list' | 'league'
  leagueId?: string
}

export async function sendConnectionRequest(fromUserId: string, input: SendRequestInput) {
  const toUser = await prisma.user.findUnique({ where: { email: input.toEmail } })

  if (toUser?.id === fromUserId) throw new Error('errors.cannot_connect_self')

  await deductCredits(fromUserId, 'add_player', { toEmail: input.toEmail })

  const request = await prisma.connectionRequest.create({
    data: {
      fromUserId,
      toUserId: toUser?.id ?? null,
      toEmail: input.toEmail,
      inviteToken: toUser ? null : crypto.randomBytes(24).toString('hex'),
      context: input.context,
      leagueId: input.leagueId ?? null,
      status: 'pending',
    },
  })

  if (toUser) {
    await createNotification(toUser.id, 'connection_request', { requestId: request.id, fromUserId })
  }

  return request
}

export async function acceptConnectionRequest(requestId: string, userId: string) {
  const request = await prisma.connectionRequest.findUnique({ where: { id: requestId } })
  if (!request || request.toUserId !== userId || request.status !== 'pending') {
    throw new Error('errors.not_found')
  }

  await prisma.vaultConnection.create({ data: { userId: request.fromUserId, connectedUserId: userId } })
  await prisma.vaultConnection.create({ data: { userId, connectedUserId: request.fromUserId } })

  const player = await prisma.player.findFirst({
    where: { userId: request.fromUserId, linkedUserId: null, name: { not: '' } },
  })

  if (player) {
    await prisma.player.update({ where: { id: player.id }, data: { linkedUserId: userId } })
  }

  if (request.context === 'league' && request.leagueId) {
    const linkedPlayer = await prisma.player.findFirst({
      where: { userId: request.fromUserId, linkedUserId: userId },
    })
    if (linkedPlayer) {
      await prisma.leagueMember.create({ data: { leagueId: request.leagueId, playerId: linkedPlayer.id } }).catch(() => {})
    }
  }

  await prisma.connectionRequest.update({ where: { id: requestId }, data: { status: 'accepted' } })
  await createNotification(request.fromUserId, 'connection_accepted', { requestId, connectedUserId: userId })
}

export async function declineConnectionRequest(requestId: string, userId: string) {
  const request = await prisma.connectionRequest.findUnique({ where: { id: requestId } })
  if (!request || request.toUserId !== userId) throw new Error('errors.not_found')

  await prisma.connectionRequest.update({ where: { id: requestId }, data: { status: 'declined' } })
  await createNotification(request.fromUserId, 'connection_declined', { requestId })
}

export async function disconnectVaultKeeper(userId: string, connectedUserId: string) {
  await prisma.vaultConnection.deleteMany({
    where: { OR: [
      { userId, connectedUserId },
      { userId: connectedUserId, connectedUserId: userId },
    ]},
  })

  await prisma.player.updateMany({
    where: { userId, linkedUserId: connectedUserId },
    data: { linkedUserId: null },
  })

  await prisma.leagueMember.deleteMany({
    where: {
      player: { userId, linkedUserId: null },
      league: { ownerId: userId },
    },
  })
}

export async function acceptLeagueInvite(leagueId: string, userId: string) {
  const player = await prisma.player.findFirst({
    where: { user: { vaultConnections: { some: { connectedUserId: userId } } }, linkedUserId: userId },
  })
  if (!player) throw new Error('errors.not_found')

  await prisma.leagueMember.create({ data: { leagueId, playerId: player.id } }).catch(() => {})
  await createNotification(userId, 'league_invite_accepted', { leagueId })
}
```

- [ ] **Step 4: Run — should pass**

```bash
npm test src/lib/connections.test.ts
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/connections.ts src/lib/connections.test.ts
git commit -m "feat: add vault keeper connection business logic"
```

---

## Task 9: Notification business logic

**Files:**
- Create: `src/lib/notifications.ts`
- Create: `src/lib/notifications.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

beforeEach(() => vi.clearAllMocks())

describe('createNotification', () => {
  it('inserts a notification record', async () => {
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'n1', type: 'connection_request', read: false } as never)

    const { createNotification } = await import('@/lib/notifications')
    const result = await createNotification('user-1', 'connection_request', { fromUserId: 'user-2' })
    expect(result.type).toBe('connection_request')
  })
})

describe('getNotifications', () => {
  it('returns notifications for the user', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      { id: 'n1', type: 'connection_request', read: false },
    ] as never)

    const { getNotifications } = await import('@/lib/notifications')
    const result = await getNotifications('user-1')
    expect(result).toHaveLength(1)
  })
})

describe('markAllRead', () => {
  it('updates all unread notifications for the user', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 })

    const { markAllRead } = await import('@/lib/notifications')
    const result = await markAllRead('user-1')
    expect(result.count).toBe(3)
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm test src/lib/notifications.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/notifications'`

- [ ] **Step 3: Create `src/lib/notifications.ts`**

```ts
import { prisma } from '@/lib/prisma'

export type NotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'connection_declined'
  | 'league_invite'
  | 'league_invite_accepted'
  | 'played_game_pending'
  | 'played_game_accepted'
  | 'played_game_rejected'

export async function createNotification(
  userId: string,
  type: NotificationType,
  meta?: Record<string, unknown>
) {
  return prisma.notification.create({ data: { userId, type, meta } })
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } })
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } })
}
```

- [ ] **Step 4: Run — should pass**

```bash
npm test src/lib/notifications.test.ts
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications.ts src/lib/notifications.test.ts
git commit -m "feat: add notification business logic"
```

---

## Task 10: Connection API routes

**Files:**
- Create: `src/app/api/connections/route.ts`
- Create: `src/app/api/connections/[id]/route.ts`
- Create: `src/app/api/connections/disconnect/route.ts`
- Create: `src/app/api/notifications/route.ts`

- [ ] **Step 1: Create `src/app/api/connections/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sendConnectionRequest } from '@/lib/connections'
import { InsufficientCreditsError } from '@/lib/credits'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const SendSchema = z.object({
  toEmail: z.string().email(),
  context: z.enum(['player_list', 'league']),
  leagueId: z.string().cuid().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const requests = await prisma.connectionRequest.findMany({
    where: {
      toUserId: session.user.id,
      ...(status ? { status } : {}),
    },
    include: { fromUser: { select: { id: true, email: true } }, league: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(requests)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })

  const parsed = SendSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'errors.invalid_form' }, { status: 400 })

  try {
    const request = await sendConnectionRequest(session.user.id, parsed.data)
    return NextResponse.json(request, { status: 201 })
  } catch (e) {
    if (e instanceof InsufficientCreditsError) return NextResponse.json({ error: e.message }, { status: 402 })
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}
```

- [ ] **Step 2: Create `src/app/api/connections/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { acceptConnectionRequest, declineConnectionRequest } from '@/lib/connections'
import { z } from 'zod'

const PatchSchema = z.object({ action: z.enum(['accept', 'decline']) })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = PatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'errors.invalid_form' }, { status: 400 })

  try {
    if (parsed.data.action === 'accept') {
      await acceptConnectionRequest(id, session.user.id)
    } else {
      await declineConnectionRequest(id, session.user.id)
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'errors.not_found' }, { status: 404 })
  }
}
```

- [ ] **Step 3: Create `src/app/api/connections/disconnect/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { disconnectVaultKeeper } from '@/lib/connections'
import { z } from 'zod'

const DisconnectSchema = z.object({ connectedUserId: z.string().cuid() })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const parsed = DisconnectSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'errors.invalid_form' }, { status: 400 })
  await disconnectVaultKeeper(session.user.id, parsed.data.connectedUserId)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Create `src/app/api/notifications/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getNotifications, markAllRead } from '@/lib/notifications'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  const notifications = await getNotifications(session.user.id)
  return NextResponse.json(notifications)
}

export async function PATCH() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'errors.unauthorized' }, { status: 401 })
  await markAllRead(session.user.id)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/connections/ src/app/api/notifications/
git commit -m "feat: add connection and notification API routes"
```

---

## Task 11: NotificationBell component

**Files:**
- Create: `src/components/shared/NotificationBell.tsx`

- [ ] **Step 1: Create `src/components/shared/NotificationBell.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { BellIcon } from 'lucide-react'

interface Notification {
  id: string
  type: string
  meta: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

const NOTIFICATION_LABELS: Record<string, string> = {
  connection_request: 'New connection request',
  connection_accepted: 'Connection accepted',
  connection_declined: 'Connection declined',
  league_invite: 'Invited to a league',
  league_invite_accepted: 'League invite accepted',
  played_game_pending: 'New game awaiting approval',
  played_game_accepted: 'Your game was approved',
  played_game_rejected: 'Your game was rejected',
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then(setNotifications)
      .catch(() => {})
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function handleOpen() {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) {
      await fetch('/api/notifications', { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-surface-container transition-colors"
        aria-label="Notifications"
      >
        <BellIcon size={20} className="text-on-surface-variant" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-primary text-on-primary text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant">
            <p className="font-headline font-semibold text-sm text-on-surface">Notifications</p>
          </div>
          {notifications.length === 0 && (
            <p className="text-on-surface-variant text-sm px-4 py-3">No notifications yet.</p>
          )}
          <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant">
            {notifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 ${n.read ? '' : 'bg-primary-container/30'}`}>
                <p className="text-sm text-on-surface">{NOTIFICATION_LABELS[n.type] ?? n.type}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {new Date(n.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `NotificationBell` to the app header/sidebar**

Open `src/components/layout/Sidebar.tsx` (or `MobileHeader.tsx` — wherever the app header lives) and add the bell:

```tsx
import { NotificationBell } from '@/components/shared/NotificationBell'

// Inside the header/top-bar area:
<NotificationBell />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/NotificationBell.tsx src/components/layout/
git commit -m "feat: add notification bell component"
```

---

## Task 12: QR code on profile page

**Files:**
- Modify: `src/app/app/settings/page.tsx`
- Create: `src/components/shared/QRCode.tsx`

- [ ] **Step 1: Install qrcode**

```bash
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Create `src/components/shared/QRCode.tsx`**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import QRCodeLib from 'qrcode'

interface QRCodeProps {
  value: string
  size?: number
}

export function QRCode({ value, size = 200 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#2b3437', light: '#ffffff' },
    })
  }, [value, size])

  return <canvas ref={canvasRef} className="rounded-lg" />
}
```

- [ ] **Step 3: Add QR code section to settings page**

In `src/app/app/settings/page.tsx`, add the QR code section. The QR value should encode the vault keeper's username or a deep link to their profile. Since we use email as the identifier, encode a connection URL:

```tsx
import { QRCode } from '@/components/shared/QRCode'
import { auth } from '@/lib/auth'

// Inside the settings page, add:
const session = await auth()
const qrValue = `${process.env.NEXT_PUBLIC_APP_URL}/connect?username=${session?.user?.email}`

// In JSX:
<section>
  <h2 className="font-headline font-semibold text-lg mb-3">Your QR Code</h2>
  <p className="text-on-surface-variant text-sm mb-4">
    Others can scan this to connect with you as a vault keeper.
  </p>
  <QRCode value={qrValue} size={180} />
</section>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/QRCode.tsx src/app/app/settings/ package.json package-lock.json
git commit -m "feat: add QR code for vault keeper profile"
```

---

## Task 13: Pending approval page

**Files:**
- Create: `src/app/app/leagues/[id]/played-games/[pgId]/approve/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ApprovePage() {
  const router = useRouter()
  const { id, pgId } = useParams<{ id: string; pgId: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(true)
    const res = await fetch(`/api/leagues/${id}/played-games/${pgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'errors.server_error')
      setLoading(false)
      return
    }

    router.push(`/app/leagues/${id}`)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="font-headline font-bold text-2xl text-on-surface mb-2">Review Played Game</h1>
      <p className="text-on-surface-variant text-sm mb-6">
        A connected vault keeper submitted this result. Credits are non-refundable on rejection.
      </p>

      {error && <p className="text-error text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading}
          className="flex-1 bg-primary text-on-primary py-2 rounded-lg font-medium hover:bg-primary-dim disabled:opacity-50 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={loading}
          className="flex-1 border border-error text-error py-2 rounded-lg font-medium hover:bg-error/10 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/leagues/[id]/played-games/
git commit -m "feat: add played game approval/rejection page"
```

---

## Task 13b: Players page — connection invite UI

**Files:**
- Modify: `src/app/app/players/page.tsx`

- [ ] **Step 1: Add invite form to the players page**

In `src/app/app/players/page.tsx`, add a section for inviting vault keepers. This sits below the existing player list:

```tsx
'use client'
// (convert to client component or extract InviteForm as a client component)

function InviteForm() {
  const [email, setEmail] = useState('')
  const [context] = useState<'player_list'>('player_list')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail: email, context }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'errors.server_error')
      setStatus('error')
      return
    }
    setStatus('sent')
    setEmail('')
  }

  return (
    <div className="mt-8 border-t border-outline-variant pt-6">
      <h2 className="font-headline font-semibold text-lg mb-3">Connect a Vault Keeper</h2>
      <p className="text-on-surface-variant text-sm mb-4">
        Invite another vault keeper by email. They pay 10 credits from your balance.
      </p>
      {status === 'sent' && (
        <p className="text-sm text-primary mb-3">Invite sent! They will appear once they accept.</p>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="their@email.com"
          className="flex-1 border border-outline-variant rounded-lg px-3 py-2 text-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
          required
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dim disabled:opacity-50 transition-colors"
        >
          {status === 'sending' ? 'Sending…' : 'Invite (10 credits)'}
        </button>
      </form>
      {status === 'error' && <p className="text-error text-sm mt-2">{error}</p>}
    </div>
  )
}
```

Add `<InviteForm />` at the bottom of the players page JSX.

Also add a vault keeper badge to players with `linkedUserId`:

```tsx
{players.map((p) => (
  <div key={p.id} className="flex items-center gap-2 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant">
    <span className="font-medium text-on-surface">{p.name}</span>
    {p.linkedUserId && (
      <span className="text-xs bg-primary-container text-primary px-2 py-0.5 rounded-full font-medium">
        Vault Keeper
      </span>
    )}
  </div>
))}
```

- [ ] **Step 2: Add pending connection requests section**

Below `<InviteForm />`, show incoming pending requests:

```tsx
// Fetch pending requests server-side and pass as props, or add a client fetch:
const pendingRes = await fetch('/api/connections?status=pending')
// Then render Accept/Decline buttons per request calling PATCH /api/connections/[id]
```

> The `/api/connections` GET route can be extended to filter by `?status=pending` and return requests where `toUserId = session.user.id`.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/players/
git commit -m "feat: add vault keeper connection invite UI to players page"
```

---

## Task 14: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected output:
```
✓ src/lib/prisma.test.ts (2 tests)
✓ src/lib/redis.test.ts (3 tests)
✓ src/app/api/health/route.test.ts (3 tests)
✓ src/lib/credits.test.ts (4 tests)
✓ src/lib/leagues.test.ts (3 tests)
✓ src/lib/played-games.test.ts (4 tests)
✓ src/lib/connections.test.ts (3 tests)
✓ src/lib/notifications.test.ts (3 tests)

Test Files  8 passed (8)
Tests       25 passed (25)
```

If any tests fail, fix before continuing.

- [ ] **Step 2: Commit fixes if needed**

```bash
git add -A
git commit -m "test: all group features tests passing"
```

---

## Phase 4 — Email notifications + admin approvals

---

## Task 15: Email templates for group features

**Files:**
- Modify: `messages/nl/emails.json`
- Modify: `messages/en/emails.json`
- Modify: `src/lib/connections.ts` (wire up email sends)
- Modify: `src/lib/played-games.ts` (wire up email sends)

> Requires `src/lib/mail.ts` to exist (Phase 1b). This task wires up email sends to the connection and played game approval flows.

- [ ] **Step 1: Add email keys to `messages/en/emails.json`**

Add these keys to the existing `emails.json`:

```json
{
  "connection_request": {
    "subject": "You have a new connection request on Dice Vault",
    "body": "{fromEmail} wants to connect with you as a vault keeper."
  },
  "connection_accepted": {
    "subject": "Connection accepted on Dice Vault",
    "body": "{connectedEmail} accepted your connection request."
  },
  "connection_declined": {
    "subject": "Connection request declined",
    "body": "Your connection request was declined."
  },
  "league_invite": {
    "subject": "You've been invited to a league on Dice Vault",
    "body": "{ownerEmail} invited you to join the league \"{leagueName}\"."
  },
  "played_game_pending": {
    "subject": "A played game awaits your approval",
    "body": "{submitterEmail} logged a game in your league \"{leagueName}\" and it needs your approval."
  },
  "played_game_accepted": {
    "subject": "Your game was approved",
    "body": "Your played game in \"{leagueName}\" was approved."
  },
  "played_game_rejected": {
    "subject": "Your game was rejected",
    "body": "Your played game in \"{leagueName}\" was rejected. Credits spent are non-refundable."
  }
}
```

- [ ] **Step 2: Add same keys to `messages/nl/emails.json`**

```json
{
  "connection_request": {
    "subject": "Nieuw verbindingsverzoek op Dice Vault",
    "body": "{fromEmail} wil verbinden als vault keeper."
  },
  "connection_accepted": {
    "subject": "Verbinding geaccepteerd op Dice Vault",
    "body": "{connectedEmail} heeft je verzoek geaccepteerd."
  },
  "connection_declined": {
    "subject": "Verbindingsverzoek geweigerd",
    "body": "Je verbindingsverzoek is geweigerd."
  },
  "league_invite": {
    "subject": "Je bent uitgenodigd voor een league op Dice Vault",
    "body": "{ownerEmail} heeft je uitgenodigd voor de league \"{leagueName}\"."
  },
  "played_game_pending": {
    "subject": "Een gespeeld spel wacht op je goedkeuring",
    "body": "{submitterEmail} heeft een spel gelogd in je league \"{leagueName}\" en het wacht op goedkeuring."
  },
  "played_game_accepted": {
    "subject": "Je spel is goedgekeurd",
    "body": "Je gespeelde spel in \"{leagueName}\" is goedgekeurd."
  },
  "played_game_rejected": {
    "subject": "Je spel is afgewezen",
    "body": "Je gespeelde spel in \"{leagueName}\" is afgewezen. Gebruikte credits worden niet teruggestort."
  }
}
```

- [ ] **Step 3: Add email send to `sendConnectionRequest` in `src/lib/connections.ts`**

Add at the top:
```ts
import { sendEmail } from '@/lib/mail'
```

After `createNotification` in `sendConnectionRequest`, add:
```ts
if (toUser) {
  const fromUser = await prisma.user.findUnique({ where: { id: fromUserId }, select: { email: true } })
  await sendEmail(toUser.email, toUser.locale ?? 'en', 'connection_request', {
    fromEmail: fromUser?.email ?? '',
  })
}
```

- [ ] **Step 4: Add email send to `approvePlayedGame` and `rejectPlayedGame` in `src/lib/played-games.ts`**

Add at the top:
```ts
import { sendEmail } from '@/lib/mail'
import { createNotification } from '@/lib/notifications'
```

In `approvePlayedGame`, after the update:
```ts
const submitter = await prisma.user.findUnique({ where: { id: pg.submittedById }, select: { email: true, locale: true } })
await createNotification(pg.submittedById, 'played_game_accepted', { leagueId: pg.leagueId })
if (submitter) {
  await sendEmail(submitter.email, submitter.locale ?? 'en', 'played_game_accepted', {
    leagueName: pg.league.name,
  })
}
```

In `rejectPlayedGame`, after the update:
```ts
const submitter = await prisma.user.findUnique({ where: { id: pg.submittedById }, select: { email: true, locale: true } })
await createNotification(pg.submittedById, 'played_game_rejected', { leagueId: pg.leagueId })
if (submitter) {
  await sendEmail(submitter.email, submitter.locale ?? 'en', 'played_game_rejected', {
    leagueName: pg.league.name,
  })
}
```

> Note: `sendEmail(to, locale, templateKey, variables)` is the helper from `src/lib/mail.ts` (Phase 1b). The exact signature will match what was built in Phase 1b — adjust if needed.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests still pass (mail.ts is mocked globally)

- [ ] **Step 6: Commit**

```bash
git add messages/ src/lib/connections.ts src/lib/played-games.ts
git commit -m "feat: add email notifications for connections and played game approvals"
```

---

## Task 16: Admin — pending approvals view

**Files:**
- Create: `src/app/admin/approvals/page.tsx`

- [ ] **Step 1: Create `src/app/admin/approvals/page.tsx`**

```tsx
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminApprovalsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') redirect('/en/auth/login')

  const pending = await prisma.playedGame.findMany({
    where: { status: 'pending_approval' },
    include: {
      league: { include: { owner: { select: { email: true } } } },
      submittedBy: { select: { email: true } },
      scores: { include: { player: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="p-6">
      <h1 className="font-headline font-bold text-2xl mb-6">Pending Game Approvals</h1>

      {pending.length === 0 && (
        <p className="text-on-surface-variant">No pending approvals.</p>
      )}

      <div className="space-y-4">
        {pending.map((pg) => (
          <div key={pg.id} className="bg-white border border-outline-variant rounded-xl p-4">
            <p className="font-medium text-on-surface">
              {pg.league.name} — submitted by {pg.submittedBy.email}
            </p>
            <p className="text-sm text-on-surface-variant">
              League owner: {pg.league.owner.email} · {new Date(pg.playedAt).toLocaleDateString()}
            </p>
            <div className="mt-2 text-sm">
              {pg.scores.map((s) => (
                <span key={s.id} className="mr-3">
                  {s.player.name}: <strong>{s.score}</strong>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add link to admin sidebar**

In `src/components/layout/AdminSidebar.tsx`, add a navigation link to `/admin/approvals`.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/approvals/ src/components/layout/AdminSidebar.tsx
git commit -m "feat: add admin pending approvals view"
```

---

## Task 17: Run full test suite + build check

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 3: Update README phase changelog**

Open `README.md` and add to the Phase changelog table:

```markdown
| Group features | Leagues, PlayedGame (renamed Session), vault keeper connections, shared vault UI, notification bell, QR code, approval flow |
```

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: update README with group features phase notes"
```
