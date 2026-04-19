# Phase 2 — Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core Dice Vault app loop — Players CRUD, Game Template wizard (25 cr), League creation (10 cr), PlayedGame logging (5 cr) — with full credit deduction, rate limiting, and low-credit banner.

**Architecture:** Owner-only in Phase 2 (no social graph yet). Credit deduction uses dual-pool logic (monthly first, then permanent). All actions go through `lib/credits.ts`; Redis rate-limits double-submits within 3 s.

**Tech Stack:** Next.js 15 App Router, Prisma 5, ioredis, Vitest, Tailwind CSS v3, shadcn/ui, next-intl, Lucide React

---

## File Map

**New files:**
- `prisma/schema.prisma` — add 8 models (update in place)
- `prisma/seed.ts` — upsert AdminSettings rows
- `src/lib/credits.ts` — deductCredits, getActionCost, isFreeModeActive, checkRateLimit
- `src/lib/credits.test.ts` — unit tests for credit engine
- `src/components/shared/Avatar.tsx` — deterministic initials + color
- `src/app/app/players/actions.ts` — createPlayer, updatePlayer, deletePlayer
- `src/app/app/players/page.tsx` — players list page
- `src/test/players-actions.test.ts` — player action tests
- `src/app/app/games/actions.ts` — createGameTemplate
- `src/app/app/games/page.tsx` — game templates list
- `src/app/app/games/new/page.tsx` — 3-step wizard (client)
- `src/test/games-actions.test.ts` — game template action tests
- `src/app/app/leagues/actions.ts` — createLeague, deleteLeague
- `src/app/app/leagues/page.tsx` — leagues list
- `src/app/app/leagues/new/page.tsx` — create league wizard (client)
- `src/app/app/leagues/[id]/page.tsx` — league detail
- `src/app/app/leagues/[id]/actions.ts` — logPlayedGame
- `src/app/app/leagues/[id]/log/page.tsx` — log played game form
- `src/test/leagues-actions.test.ts` — league + played game action tests
- `src/components/credits/LowCreditBanner.tsx` — low-credit warning banner

**Modified files:**
- `src/components/layout/Sidebar.tsx` — rename `sessions` nav → `leagues`
- `src/app/app/layout.tsx` — mount LowCreditBanner
- `messages/nl/app.json` — add all Phase 2 keys, rename sessions→leagues
- `messages/en/app.json` — same
- `package.json` — add prisma seed script
- `README.md` — phase 2 changelog entry

---

## Task 1: Schema Migration — Add Phase 2 Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema.prisma with the full Phase 2 schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               String    @id @default(cuid())
  email            String    @unique
  passwordHash     String
  emailVerified    DateTime?
  locale           String    @default("en")
  role             String    @default("user")

  totpSecret       String?
  totpEnabled      Boolean   @default(false)
  totpBackupCodes  String[]
  requiresMfa      Boolean   @default(false)

  monthlyCredits   Int       @default(75)
  permanentCredits Int       @default(0)
  isLifetimeFree   Boolean   @default(false)

  players            Player[]
  linkedAsPlayer     Player[]            @relation("LinkedPlayer")
  gameTemplates      GameTemplate[]
  ownedLeagues       League[]            @relation("OwnedLeagues")
  playedGames        PlayedGame[]        @relation("SubmittedPlayedGames")
  creditTransactions CreditTransaction[]

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
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
  pool      String   @default("monthly")
  reason    String
  meta      Json?
  createdAt DateTime @default(now())
}

model AdminSettings {
  key   String @id
  value Json
}

model FreePeriod {
  id           String   @id @default(cuid())
  label        String
  startsAt     DateTime
  endsAt       DateTime
  bannerTextNl String   @default("Gratis periode actief — gebruik zoveel je wilt")
  bannerTextEn String   @default("Free period active — use as much as you like")
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name phase2-core-models
```

Expected: Migration created and applied. `prisma generate` runs automatically.

- [ ] **Step 3: Verify migration ran cleanly**

```bash
npx prisma db pull --print | head -10
```

Expected: Schema round-trips correctly (no drift warnings).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add Phase 2 models — Player, GameTemplate, League, LeagueMember, PlayedGame, ScoreEntry, CreditTransaction, FreePeriod"
```

---

## Task 2: Seed AdminSettings

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const settings: { key: string; value: unknown }[] = [
    { key: 'monthly_free_credits',    value: 75 },
    { key: 'cost_game_template',      value: 25 },
    { key: 'cost_league',             value: 10 },
    { key: 'cost_add_player',         value: 10 },
    { key: 'cost_played_game',        value: 5  },
    { key: 'low_credit_threshold',    value: 20 },
    { key: 'strike_enabled',          value: false },
    { key: 'bitcoin_discount_percent',value: 10 },
    { key: 'oss_threshold_cents',     value: 1000000 },
    { key: 'free_mode_active',        value: false },
    { key: 'free_mode_banner_nl',     value: 'Gratis periode actief — gebruik zoveel je wilt' },
    { key: 'free_mode_banner_en',     value: 'Free period active — use as much as you like' },
  ]

  for (const s of settings) {
    await prisma.adminSettings.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    })
  }

  console.log(`Seeded ${settings.length} AdminSettings rows`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
```

- [ ] **Step 2: Add seed script to `package.json`**

In `package.json`, add a `prisma` block (or inside an existing one):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
},
```

If `tsx` is not installed:

```bash
npm install --save-dev tsx
```

- [ ] **Step 3: Run seed**

```bash
npx prisma db seed
```

Expected: `Seeded 12 AdminSettings rows`

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat(seed): add AdminSettings seed with action costs and free-mode defaults"
```

---

## Task 3: lib/credits.ts — Credit Deduction Engine

**Files:**
- Create: `src/lib/credits.ts`
- Create: `src/lib/credits.test.ts`

- [ ] **Step 1: Write failing tests in `src/lib/credits.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deductCredits, getActionCost, isFreeModeActive, checkRateLimit, InsufficientCreditsError } from './credits'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminSettings: { findUnique: vi.fn() },
    freePeriod: { findFirst: vi.fn() },
    user: { findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn() },
}))

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const mockUser = (overrides: Partial<{
  monthlyCredits: number
  permanentCredits: number
  isLifetimeFree: boolean
}> = {}) => ({
  monthlyCredits: 75,
  permanentCredits: 0,
  isLifetimeFree: false,
  ...overrides,
})

beforeEach(() => {
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.freePeriod.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.$transaction).mockResolvedValue([])
})

describe('getActionCost', () => {
  it('returns DB value when set', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'cost_game_template', value: 30 })
    expect(await getActionCost('game_template')).toBe(30)
  })

  it('falls back to hardcoded defaults', async () => {
    expect(await getActionCost('game_template')).toBe(25)
    expect(await getActionCost('league')).toBe(10)
    expect(await getActionCost('played_game')).toBe(5)
  })
})

describe('isFreeModeActive', () => {
  it('returns true when toggle is on', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'free_mode_active', value: true })
    expect(await isFreeModeActive()).toBe(true)
  })

  it('returns true when inside a FreePeriod', async () => {
    vi.mocked(prisma.freePeriod.findFirst).mockResolvedValue({ id: 'fp1' } as never)
    expect(await isFreeModeActive()).toBe(true)
  })

  it('returns false when toggle off and no active period', async () => {
    expect(await isFreeModeActive()).toBe(false)
  })
})

describe('checkRateLimit', () => {
  it('passes when no rate limit entry exists', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK')
    await expect(checkRateLimit('user-1', 'game_template')).resolves.not.toThrow()
  })

  it('throws when rate limit is hit', async () => {
    vi.mocked(redis.set).mockResolvedValue(null)
    await expect(checkRateLimit('user-1', 'game_template')).rejects.toThrow('Rate limit')
  })
})

describe('deductCredits', () => {
  it('Case A: deducts entirely from monthly when monthly >= cost', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 75 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    expect(result).toEqual({ newMonthly: 50, newPermanent: 0 })
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('Case B: splits across monthly and permanent when monthly < cost', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 10, permanentCredits: 20 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    expect(result).toEqual({ newMonthly: 0, newPermanent: 5 })
  })

  it('Case C: deducts from permanent when monthly <= 0', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 0, permanentCredits: 30 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    expect(result).toEqual({ newMonthly: 0, newPermanent: 5 })
  })

  it('throws InsufficientCreditsError when total < cost and not free mode', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 5, permanentCredits: 0 }) as never)
    await expect(deductCredits('user-1', 'game_template')).rejects.toBeInstanceOf(InsufficientCreditsError)
  })

  it('skips deduction for lifetime-free users', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ isLifetimeFree: true, monthlyCredits: 0, permanentCredits: 0 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    expect(result).toEqual({ newMonthly: 0, newPermanent: 0 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('Case B free mode: allows negative monthly when total < cost', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'free_mode_active', value: true })
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 3, permanentCredits: 1 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    // cost=25, monthly=3, permanent=1 → monthly goes to -21, permanent to 0
    expect(result.newPermanent).toBe(0)
    expect(result.newMonthly).toBe(-21)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/credits.test.ts
```

Expected: FAIL — `credits.ts` does not exist.

- [ ] **Step 3: Create `src/lib/credits.ts`**

```typescript
import { prisma } from './prisma'
import { redis } from './redis'

export class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credits')
    this.name = 'InsufficientCreditsError'
  }
}

const COST_DEFAULTS: Record<string, number> = {
  game_template: 25,
  league: 10,
  add_player: 10,
  played_game: 5,
}

export async function getActionCost(action: string): Promise<number> {
  const setting = await prisma.adminSettings.findUnique({ where: { key: `cost_${action}` } })
  return (setting?.value as number) ?? COST_DEFAULTS[action] ?? 0
}

export async function isFreeModeActive(): Promise<boolean> {
  const toggle = await prisma.adminSettings.findUnique({ where: { key: 'free_mode_active' } })
  if (toggle?.value === true) return true
  const now = new Date()
  const period = await prisma.freePeriod.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
  })
  return !!period
}

export async function checkRateLimit(userId: string, action: string): Promise<void> {
  const key = `rl:${action}:${userId}`
  const result = await redis.set(key, '1', 'EX', 3, 'NX')
  if (!result) throw new Error('Rate limit: please wait before trying again')
}

export async function deductCredits(
  userId: string,
  action: string,
  meta?: Record<string, unknown>
): Promise<{ newMonthly: number; newPermanent: number }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { monthlyCredits: true, permanentCredits: true, isLifetimeFree: true },
  })

  if (user.isLifetimeFree) {
    return { newMonthly: user.monthlyCredits, newPermanent: user.permanentCredits }
  }

  const cost = await getActionCost(action)
  const freeModeActive = await isFreeModeActive()
  const { monthlyCredits: monthly, permanentCredits: permanent } = user

  if (!freeModeActive && monthly + permanent < cost) {
    throw new InsufficientCreditsError()
  }

  let newMonthly = monthly
  let newPermanent = permanent
  const txs: { pool: string; delta: number }[] = []

  if (monthly >= cost) {
    // Case A: monthly covers full cost
    newMonthly = monthly - cost
    txs.push({ pool: 'monthly', delta: -cost })
  } else if (monthly > 0) {
    // Case B: partial monthly, remainder from permanent (or negative)
    const partial = monthly
    const remainder = cost - partial
    if (permanent >= remainder) {
      newMonthly = 0
      newPermanent = permanent - remainder
      txs.push({ pool: 'monthly', delta: -partial })
      txs.push({ pool: 'permanent', delta: -remainder })
    } else {
      // freeModeActive guaranteed here (checked above)
      newMonthly = -(remainder - permanent)
      newPermanent = 0
      txs.push({ pool: 'monthly', delta: newMonthly - monthly })
      txs.push({ pool: 'permanent', delta: -permanent })
    }
  } else {
    // Case C: monthly <= 0, deduct from permanent (or further negative)
    if (permanent >= cost) {
      newPermanent = permanent - cost
      txs.push({ pool: 'permanent', delta: -cost })
    } else {
      // freeModeActive guaranteed here
      newPermanent = 0
      newMonthly = monthly - (cost - permanent)
      txs.push({ pool: 'permanent', delta: -permanent })
      txs.push({ pool: 'monthly', delta: -(cost - permanent) })
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { monthlyCredits: newMonthly, permanentCredits: newPermanent },
    }),
    ...txs.map(tx =>
      prisma.creditTransaction.create({
        data: { userId, delta: tx.delta, pool: tx.pool, reason: action, meta: meta ?? null },
      })
    ),
  ])

  return { newMonthly, newPermanent }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/lib/credits.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/credits.ts src/lib/credits.test.ts
git commit -m "feat(credits): add deductCredits engine with dual-pool logic and rate limiting"
```

---

## Task 4: i18n Updates + Sidebar Nav

**Files:**
- Modify: `messages/nl/app.json`
- Modify: `messages/en/app.json`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace `messages/nl/app.json`**

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "players": "Spelers",
    "games": "Spellen",
    "leagues": "Competities",
    "credits": "Credits",
    "settings": "Instellingen"
  },
  "credits": {
    "balance": "{n} credits",
    "low": "Bijna op",
    "lowBanner": "Je credits raken op. Koop meer om te blijven spelen.",
    "buyCredits": "Credits kopen"
  },
  "players": {
    "title": "Spelers",
    "add": "Speler toevoegen",
    "edit": "Speler bewerken",
    "delete": "Verwijderen",
    "cancel": "Annuleren",
    "save": "Opslaan",
    "empty": "Nog geen spelers. Voeg je eerste speler toe!",
    "namePlaceholder": "Naam van de speler",
    "deleteConfirm": "Weet je zeker dat je deze speler wilt verwijderen?",
    "deleteWarning": "Alle scores van deze speler blijven bewaard."
  },
  "games": {
    "title": "Spellen",
    "add": "Spel toevoegen",
    "empty": "Nog geen spelsjablonen. Maak je eerste spel!",
    "wizard": {
      "step1Title": "Speldetails",
      "step2Title": "Puntentelling",
      "step3Title": "Bevestigen",
      "namePlaceholder": "Naam van het spel (bijv. Catan)",
      "descriptionPlaceholder": "Korte beschrijving (optioneel)",
      "scoringNotesPlaceholder": "Hoe wordt gescoord? (optioneel)",
      "cost": "Dit kost 25 credits",
      "confirm": "Spel aanmaken",
      "back": "Terug",
      "next": "Volgende",
      "creating": "Aanmaken..."
    }
  },
  "leagues": {
    "title": "Competities",
    "add": "Competitie aanmaken",
    "empty": "Nog geen competities. Maak je eerste competitie!",
    "playedGames": "Gespeelde partijen",
    "logGame": "Partij loggen",
    "noGames": "Nog geen partijen gespeeld.",
    "members": "Deelnemers",
    "wizard": {
      "step1Title": "Competitiedetails",
      "step2Title": "Spelers toevoegen",
      "step3Title": "Bevestigen",
      "namePlaceholder": "Naam van de competitie (bijv. Woensdag Catan)",
      "descriptionPlaceholder": "Beschrijving (optioneel)",
      "pickTemplate": "Kies een spel",
      "noTemplates": "Maak eerst een spelsjabloon aan.",
      "pickPlayers": "Selecteer spelers",
      "noPlayers": "Voeg eerst spelers toe.",
      "cost": "Dit kost 10 credits",
      "confirm": "Competitie aanmaken",
      "back": "Terug",
      "next": "Volgende",
      "creating": "Aanmaken..."
    }
  },
  "playedGames": {
    "log": "Partij loggen",
    "playedAt": "Gespeeld op",
    "notes": "Notities (optioneel)",
    "scores": "Scores",
    "scorePlaceholder": "Score",
    "submit": "Opslaan (5 credits)",
    "submitting": "Opslaan...",
    "cost": "Dit kost 5 credits"
  },
  "errors": {
    "insufficientCredits": "Niet genoeg credits. Koop meer om door te gaan.",
    "required": "Dit veld is verplicht.",
    "notFound": "Niet gevonden.",
    "serverError": "Er is iets misgegaan. Probeer het opnieuw."
  },
  "toasts": {
    "playerSaved": "Speler opgeslagen.",
    "playerDeleted": "Speler verwijderd.",
    "templateCreated": "Spelsjabloon aangemaakt.",
    "leagueCreated": "Competitie aangemaakt.",
    "gameSaved": "Partij opgeslagen."
  }
}
```

- [ ] **Step 2: Replace `messages/en/app.json`**

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "players": "Players",
    "games": "Games",
    "leagues": "Leagues",
    "credits": "Credits",
    "settings": "Settings"
  },
  "credits": {
    "balance": "{n} credits",
    "low": "Running low",
    "lowBanner": "You're running low on credits. Buy more to keep playing.",
    "buyCredits": "Buy Credits"
  },
  "players": {
    "title": "Players",
    "add": "Add player",
    "edit": "Edit player",
    "delete": "Delete",
    "cancel": "Cancel",
    "save": "Save",
    "empty": "No players yet. Add your first player!",
    "namePlaceholder": "Player name",
    "deleteConfirm": "Are you sure you want to delete this player?",
    "deleteWarning": "All scores for this player will be kept."
  },
  "games": {
    "title": "Games",
    "add": "Add game",
    "empty": "No game templates yet. Create your first game!",
    "wizard": {
      "step1Title": "Game details",
      "step2Title": "Scoring",
      "step3Title": "Confirm",
      "namePlaceholder": "Game name (e.g. Catan)",
      "descriptionPlaceholder": "Short description (optional)",
      "scoringNotesPlaceholder": "How is scoring done? (optional)",
      "cost": "This costs 25 credits",
      "confirm": "Create game",
      "back": "Back",
      "next": "Next",
      "creating": "Creating..."
    }
  },
  "leagues": {
    "title": "Leagues",
    "add": "Create league",
    "empty": "No leagues yet. Create your first league!",
    "playedGames": "Played games",
    "logGame": "Log game",
    "noGames": "No games played yet.",
    "members": "Members",
    "wizard": {
      "step1Title": "League details",
      "step2Title": "Add players",
      "step3Title": "Confirm",
      "namePlaceholder": "League name (e.g. Wednesday Catan)",
      "descriptionPlaceholder": "Description (optional)",
      "pickTemplate": "Pick a game",
      "noTemplates": "Create a game template first.",
      "pickPlayers": "Select players",
      "noPlayers": "Add players first.",
      "cost": "This costs 10 credits",
      "confirm": "Create league",
      "back": "Back",
      "next": "Next",
      "creating": "Creating..."
    }
  },
  "playedGames": {
    "log": "Log game",
    "playedAt": "Played on",
    "notes": "Notes (optional)",
    "scores": "Scores",
    "scorePlaceholder": "Score",
    "submit": "Save (5 credits)",
    "submitting": "Saving...",
    "cost": "This costs 5 credits"
  },
  "errors": {
    "insufficientCredits": "Not enough credits. Buy more to continue.",
    "required": "This field is required.",
    "notFound": "Not found.",
    "serverError": "Something went wrong. Please try again."
  },
  "toasts": {
    "playerSaved": "Player saved.",
    "playerDeleted": "Player deleted.",
    "templateCreated": "Game template created.",
    "leagueCreated": "League created.",
    "gameSaved": "Game saved."
  }
}
```

- [ ] **Step 3: Update `src/components/layout/Sidebar.tsx` — rename sessions → leagues**

Find the NAV constant and change the `sessions` entry to `leagues`:

```typescript
const NAV = [
  { key: 'dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { key: 'players',   href: '/app/players',   icon: Users },
  { key: 'games',     href: '/app/games',     icon: Dices },
  { key: 'leagues',   href: '/app/leagues',   icon: ClipboardList },
  { key: 'credits',   href: '/app/credits',   icon: CreditCard },
  { key: 'settings',  href: '/app/settings',  icon: Settings },
] as const
```

- [ ] **Step 4: Run the app and verify the sidebar shows "Leagues" / "Competities"**

```bash
npm run dev
```

Visit `http://localhost:3000/app/dashboard`. Sidebar should show Leagues nav item (not Sessions).

- [ ] **Step 5: Commit**

```bash
git add messages/nl/app.json messages/en/app.json src/components/layout/Sidebar.tsx
git commit -m "feat(i18n): add Phase 2 translation keys, rename sessions nav to leagues"
```

---

## Task 5: Avatar Component + Players CRUD

**Files:**
- Create: `src/components/shared/Avatar.tsx`
- Create: `src/app/app/players/actions.ts`
- Create: `src/app/app/players/page.tsx`
- Create: `src/test/players-actions.test.ts`

- [ ] **Step 1: Write failing player action tests in `src/test/players-actions.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    player: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createPlayer, updatePlayer, deletePlayer } from '@/app/app/players/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('createPlayer', () => {
  it('creates a player with correct avatarSeed', async () => {
    vi.mocked(prisma.player.create).mockResolvedValue({ id: 'p1' } as never)
    const fd = new FormData()
    fd.set('name', 'Alice')
    const result = await createPlayer(fd)
    expect(result).toEqual({ success: true })
    expect(prisma.player.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', name: 'Alice', avatarSeed: 'alice' }),
    })
  })

  it('returns error when name is empty', async () => {
    const fd = new FormData()
    fd.set('name', '   ')
    const result = await createPlayer(fd)
    expect(result).toEqual({ success: false, error: 'errors.required' })
    expect(prisma.player.create).not.toHaveBeenCalled()
  })
})

describe('updatePlayer', () => {
  it('updates only own players', async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'p1', userId: 'user-1' } as never)
    vi.mocked(prisma.player.update).mockResolvedValue({ id: 'p1' } as never)
    const fd = new FormData()
    fd.set('name', 'Bob')
    const result = await updatePlayer('p1', fd)
    expect(result).toEqual({ success: true })
  })

  it('rejects update of another user\'s player', async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'p1', userId: 'other-user' } as never)
    const fd = new FormData()
    fd.set('name', 'Bob')
    const result = await updatePlayer('p1', fd)
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})

describe('deletePlayer', () => {
  it('deletes own player', async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'p1', userId: 'user-1' } as never)
    vi.mocked(prisma.player.delete).mockResolvedValue({ id: 'p1' } as never)
    const result = await deletePlayer('p1')
    expect(result).toEqual({ success: true })
  })

  it('rejects delete of another user\'s player', async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'p1', userId: 'other-user' } as never)
    const result = await deletePlayer('p1')
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/test/players-actions.test.ts
```

Expected: FAIL — `players/actions.ts` does not exist.

- [ ] **Step 3: Create `src/components/shared/Avatar.tsx`**

```typescript
const COLORS = ['#f5a623', '#e85d26', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#0891b2']

function hashColor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

export function Avatar({ seed, name, size = 36 }: { seed: string; name: string; size?: number }) {
  const bg = hashColor(seed)
  const initials = name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
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

- [ ] **Step 4: Create `src/app/app/players/actions.ts`**

```typescript
'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function makeAvatarSeed(name: string): string {
  return name.toLowerCase().trim()
}

export async function createPlayer(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { success: false, error: 'errors.required' }

  await prisma.player.create({
    data: { userId: session.user.id, name, avatarSeed: makeAvatarSeed(name) },
  })

  revalidatePath('/app/players')
  return { success: true }
}

export async function updatePlayer(
  id: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { success: false, error: 'errors.required' }

  const player = await prisma.player.findUnique({ where: { id } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.player.update({
    where: { id },
    data: { name, avatarSeed: makeAvatarSeed(name) },
  })

  revalidatePath('/app/players')
  return { success: true }
}

export async function deletePlayer(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const player = await prisma.player.findUnique({ where: { id } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.player.delete({ where: { id } })
  revalidatePath('/app/players')
  return { success: true }
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run src/test/players-actions.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Create `src/app/app/players/page.tsx`**

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import PlayersClient from './PlayersClient'

export default async function PlayersPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const [players, t] = await Promise.all([
    prisma.player.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    }),
    getTranslations({ locale: session.user.locale ?? 'en', namespace: 'app.players' }),
  ])

  return <PlayersClient players={players} t={t.raw as never} />
}
```

- [ ] **Step 7: Create `src/app/app/players/PlayersClient.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/Avatar'
import { createPlayer, updatePlayer, deletePlayer } from './actions'
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react'

type Player = { id: string; name: string; avatarSeed: string }

export default function PlayersClient({ players: initial }: { players: Player[] }) {
  const t = useTranslations('app.players')
  const [players, setPlayers] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleAdd() {
    const fd = new FormData()
    fd.set('name', newName)
    const res = await createPlayer(fd)
    if (!res.success) { toast.error(t(res.error as never)); return }
    toast.success(t('playerSaved' as never))
    setAdding(false)
    setNewName('')
    // optimistic: reload by hard refresh (server revalidates)
    window.location.reload()
  }

  async function handleUpdate(id: string) {
    const fd = new FormData()
    fd.set('name', editName)
    const res = await updatePlayer(id, fd)
    if (!res.success) { toast.error(t(res.error as never)); return }
    toast.success(t('playerSaved' as never))
    setEditId(null)
    window.location.reload()
  }

  async function handleDelete(id: string) {
    const res = await deletePlayer(id)
    if (!res.success) { toast.error(t(res.error as never)); return }
    toast.success(t('playerDeleted' as never))
    setPlayers(p => p.filter(x => x.id !== id))
    setDeleteId(null)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>
        <button
          onClick={() => { setAdding(true); setNewName('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} /> {t('add')}
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-4">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder={t('namePlaceholder')}
            className="flex-1 px-3 py-2 rounded-xl border text-sm font-body"
            style={{ borderColor: '#f5a623', outline: 'none', background: '#fffdf9' }}
          />
          <button onClick={handleAdd} className="p-2 rounded-xl" style={{ background: '#f5a623', color: '#1c1408' }}><Check size={16} /></button>
          <button onClick={() => setAdding(false)} className="p-2 rounded-xl" style={{ background: '#f0ebe3', color: '#4a3f2f' }}><X size={16} /></button>
        </div>
      )}

      {players.length === 0 && !adding && (
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      )}

      <ul className="space-y-2">
        {players.map(player => (
          <li key={player.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
            <Avatar seed={player.avatarSeed} name={player.name} size={40} />
            {editId === player.id ? (
              <div className="flex-1 flex gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdate(player.id); if (e.key === 'Escape') setEditId(null) }}
                  className="flex-1 px-3 py-1.5 rounded-xl border text-sm font-body"
                  style={{ borderColor: '#f5a623', outline: 'none', background: '#fffdf9' }}
                />
                <button onClick={() => handleUpdate(player.id)} className="p-1.5 rounded-lg" style={{ background: '#f5a623', color: '#1c1408' }}><Check size={14} /></button>
                <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg" style={{ background: '#f0ebe3', color: '#4a3f2f' }}><X size={14} /></button>
              </div>
            ) : (
              <>
                <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{player.name}</span>
                <button onClick={() => { setEditId(player.id); setEditName(player.name) }} className="p-1.5 rounded-lg hover:bg-amber-50" style={{ color: '#9a8878' }}><Pencil size={14} /></button>
                <button onClick={() => setDeleteId(player.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: '#9a8878' }}><Trash2 size={14} /></button>
              </>
            )}
          </li>
        ))}
      </ul>

      {deleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(28,24,16,0.6)' }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="font-headline font-bold text-base mb-1" style={{ color: '#1c1810' }}>{t('deleteConfirm')}</p>
            <p className="text-sm mb-6 font-body" style={{ color: '#9a8878' }}>{t('deleteWarning')}</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2 rounded-xl font-headline font-bold text-sm" style={{ background: '#ef4444', color: '#fff' }}>{t('delete')}</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl font-headline font-bold text-sm" style={{ background: '#f0ebe3', color: '#4a3f2f' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/shared/Avatar.tsx src/app/app/players/ src/test/players-actions.test.ts
git commit -m "feat(players): CRUD — create, edit, delete players with avatar generation"
```

---

## Task 6: Game Template Wizard

**Files:**
- Create: `src/app/app/games/actions.ts`
- Create: `src/app/app/games/page.tsx`
- Create: `src/app/app/games/new/page.tsx`
- Create: `src/test/games-actions.test.ts`

- [ ] **Step 1: Write failing tests in `src/test/games-actions.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    gameTemplate: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/credits', () => ({
  deductCredits: vi.fn().mockResolvedValue({ newMonthly: 50, newPermanent: 0 }),
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor() { super('Insufficient credits') }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deductCredits, checkRateLimit } from '@/lib/credits'
import { createGameTemplate, deleteGameTemplate } from '@/app/app/games/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('createGameTemplate', () => {
  it('checks rate limit and deducts credits', async () => {
    vi.mocked(prisma.gameTemplate.create).mockResolvedValue({ id: 'gt1' } as never)
    const result = await createGameTemplate({ name: 'Catan', description: '', scoringNotes: '' })
    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 'game_template')
    expect(deductCredits).toHaveBeenCalledWith('user-1', 'game_template', expect.any(Object))
    expect(result).toEqual({ success: true, id: 'gt1' })
  })

  it('returns error when name is empty', async () => {
    const result = await createGameTemplate({ name: '', description: '', scoringNotes: '' })
    expect(result).toEqual({ success: false, error: 'errors.required' })
    expect(deductCredits).not.toHaveBeenCalled()
  })

  it('returns insufficientCredits error on InsufficientCreditsError', async () => {
    const { InsufficientCreditsError } = await import('@/lib/credits')
    vi.mocked(deductCredits).mockRejectedValueOnce(new InsufficientCreditsError())
    const result = await createGameTemplate({ name: 'Catan', description: '', scoringNotes: '' })
    expect(result).toEqual({ success: false, error: 'errors.insufficientCredits' })
  })
})

describe('deleteGameTemplate', () => {
  it('deletes own template', async () => {
    vi.mocked(prisma.gameTemplate.findUnique).mockResolvedValue({ id: 'gt1', userId: 'user-1' } as never)
    vi.mocked(prisma.gameTemplate.delete).mockResolvedValue({ id: 'gt1' } as never)
    const result = await deleteGameTemplate('gt1')
    expect(result).toEqual({ success: true })
  })

  it('rejects delete of another user\'s template', async () => {
    vi.mocked(prisma.gameTemplate.findUnique).mockResolvedValue({ id: 'gt1', userId: 'other' } as never)
    const result = await deleteGameTemplate('gt1')
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/test/games-actions.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create `src/app/app/games/actions.ts`**

```typescript
'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type CreateGameTemplateInput = {
  name: string
  description: string
  scoringNotes: string
}

export async function createGameTemplate(
  input: CreateGameTemplateInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = input.name.trim()
  if (!name) return { success: false, error: 'errors.required' }

  try {
    await checkRateLimit(session.user.id, 'game_template')
    await deductCredits(session.user.id, 'game_template', { action: 'create_game_template' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'errors.insufficientCredits' }
    if ((err as Error).message.startsWith('Rate limit')) return { success: false, error: 'errors.serverError' }
    return { success: false, error: 'errors.serverError' }
  }

  const template = await prisma.gameTemplate.create({
    data: {
      userId: session.user.id,
      name,
      description: input.description.trim() || null,
      scoringNotes: input.scoringNotes.trim() || null,
    },
  })

  revalidatePath('/app/games')
  return { success: true, id: template.id }
}

export async function deleteGameTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const template = await prisma.gameTemplate.findUnique({ where: { id } })
  if (!template || template.userId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.gameTemplate.delete({ where: { id } })
  revalidatePath('/app/games')
  return { success: true }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/test/games-actions.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Create `src/app/app/games/page.tsx`**

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Dices, Plus } from 'lucide-react'

export default async function GamesPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const [templates, t] = await Promise.all([
    prisma.gameTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    }),
    getTranslations({ locale, namespace: 'app.games' }),
  ])

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>
        <Link
          href="/app/games/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} /> {t('add')}
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {templates.map(tmpl => (
            <li key={tmpl.id} className="p-4 rounded-2xl flex items-center gap-3" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                <Dices size={18} style={{ color: '#f5a623' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{tmpl.name}</div>
                {tmpl.description && <div className="text-xs font-body truncate mt-0.5" style={{ color: '#9a8878' }}>{tmpl.description}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/app/games/new/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createGameTemplate } from '../actions'
import { ChevronRight, ChevronLeft, Dices } from 'lucide-react'

type Step = 1 | 2 | 3

export default function NewGamePage() {
  const t = useTranslations('app.games.wizard')
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scoringNotes, setScoringNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    const result = await createGameTemplate({ name, description, scoringNotes })
    setLoading(false)
    if (!result.success) {
      toast.error(t(result.error as never))
      return
    }
    toast.success(t('templateCreated' as never))
    router.push('/app/games')
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-headline font-bold text-xs"
              style={{
                background: step >= s ? '#f5a623' : '#e8e1d8',
                color: step >= s ? '#1c1408' : '#9a8878',
              }}
            >
              {s}
            </div>
            {s < 3 && <div className="h-px flex-1 w-8" style={{ background: step > s ? '#f5a623' : '#e8e1d8' }} />}
          </div>
        ))}
        <span className="ml-2 font-headline font-semibold text-sm" style={{ color: '#4a3f2f' }}>
          {step === 1 ? t('step1Title') : step === 2 ? t('step2Title') : t('step3Title')}
        </span>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        {step === 1 && (
          <div className="space-y-4">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              onFocus={e => (e.target.style.borderColor = '#f5a623')}
              onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              className="w-full px-4 py-3 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              onFocus={e => (e.target.style.borderColor = '#f5a623')}
              onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
            />
          </div>
        )}

        {step === 2 && (
          <textarea
            autoFocus
            value={scoringNotes}
            onChange={e => setScoringNotes(e.target.value)}
            placeholder={t('scoringNotesPlaceholder')}
            rows={6}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                <Dices size={18} style={{ color: '#f5a623' }} />
              </div>
              <div>
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{name}</div>
                {description && <div className="text-xs font-body mt-0.5" style={{ color: '#9a8878' }}>{description}</div>}
                {scoringNotes && <div className="text-xs font-body mt-1 italic" style={{ color: '#9a8878' }}>{scoringNotes}</div>}
              </div>
            </div>
            <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
              {t('cost')}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button
            onClick={() => setStep(s => (s - 1) as Step)}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f0ebe3', color: '#4a3f2f' }}
          >
            <ChevronLeft size={16} /> {t('back')}
          </button>
        )}
        <div className="flex-1" />
        {step < 3 ? (
          <button
            onClick={() => { if (step === 1 && !name.trim()) { toast.error('Name is required'); return } setStep(s => (s + 1) as Step) }}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {t('next')} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {loading ? t('creating') : t('confirm')}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/app/games/ src/test/games-actions.test.ts
git commit -m "feat(games): game template wizard with 3 steps and 25-credit deduction"
```

---

## Task 7: Leagues — Create Wizard + List + Detail

**Files:**
- Create: `src/app/app/leagues/actions.ts`
- Create: `src/app/app/leagues/page.tsx`
- Create: `src/app/app/leagues/new/page.tsx`
- Create: `src/app/app/leagues/[id]/page.tsx`
- Create: `src/test/leagues-actions.test.ts`

- [ ] **Step 1: Write failing tests in `src/test/leagues-actions.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    league: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    leagueMember: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/credits', () => ({
  deductCredits: vi.fn().mockResolvedValue({ newMonthly: 65, newPermanent: 0 }),
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor() { super('Insufficient credits') }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deductCredits, checkRateLimit } from '@/lib/credits'
import { createLeague, deleteLeague } from '@/app/app/leagues/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown[]) => ops)
})

describe('createLeague', () => {
  it('deducts credits and creates league with members', async () => {
    vi.mocked(prisma.league.create).mockResolvedValue({ id: 'lg1' } as never)
    const result = await createLeague({
      name: 'Wednesday Catan',
      description: '',
      gameTemplateId: 'gt1',
      playerIds: ['p1', 'p2'],
    })
    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 'league')
    expect(deductCredits).toHaveBeenCalledWith('user-1', 'league', expect.any(Object))
    expect(result).toEqual({ success: true, id: 'lg1' })
  })

  it('returns error when name is empty', async () => {
    const result = await createLeague({ name: '', description: '', gameTemplateId: 'gt1', playerIds: [] })
    expect(result).toEqual({ success: false, error: 'errors.required' })
    expect(deductCredits).not.toHaveBeenCalled()
  })

  it('returns error when no game template selected', async () => {
    const result = await createLeague({ name: 'Test', description: '', gameTemplateId: '', playerIds: [] })
    expect(result).toEqual({ success: false, error: 'errors.required' })
  })

  it('returns insufficientCredits on InsufficientCreditsError', async () => {
    const { InsufficientCreditsError } = await import('@/lib/credits')
    vi.mocked(deductCredits).mockRejectedValueOnce(new InsufficientCreditsError())
    const result = await createLeague({ name: 'Test', description: '', gameTemplateId: 'gt1', playerIds: [] })
    expect(result).toEqual({ success: false, error: 'errors.insufficientCredits' })
  })
})

describe('deleteLeague', () => {
  it('deletes own league', async () => {
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'lg1', ownerId: 'user-1' } as never)
    vi.mocked(prisma.league.delete).mockResolvedValue({ id: 'lg1' } as never)
    const result = await deleteLeague('lg1')
    expect(result).toEqual({ success: true })
  })

  it('rejects delete of another user\'s league', async () => {
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'lg1', ownerId: 'other' } as never)
    const result = await deleteLeague('lg1')
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/test/leagues-actions.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create `src/app/app/leagues/actions.ts`**

```typescript
'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type CreateLeagueInput = {
  name: string
  description: string
  gameTemplateId: string
  playerIds: string[]
}

export async function createLeague(
  input: CreateLeagueInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = input.name.trim()
  if (!name) return { success: false, error: 'errors.required' }
  if (!input.gameTemplateId) return { success: false, error: 'errors.required' }

  try {
    await checkRateLimit(session.user.id, 'league')
    await deductCredits(session.user.id, 'league', { action: 'create_league' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'errors.insufficientCredits' }
    return { success: false, error: 'errors.serverError' }
  }

  const league = await prisma.league.create({
    data: {
      ownerId: session.user.id,
      name,
      description: input.description.trim() || null,
      gameTemplateId: input.gameTemplateId,
    },
  })

  if (input.playerIds.length > 0) {
    await prisma.leagueMember.createMany({
      data: input.playerIds.map(playerId => ({ leagueId: league.id, playerId })),
      skipDuplicates: true,
    })
  }

  revalidatePath('/app/leagues')
  return { success: true, id: league.id }
}

export async function deleteLeague(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const league = await prisma.league.findUnique({ where: { id } })
  if (!league || league.ownerId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.league.delete({ where: { id } })
  revalidatePath('/app/leagues')
  return { success: true }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/test/leagues-actions.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Create `src/app/app/leagues/page.tsx`**

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Plus, Trophy } from 'lucide-react'

export default async function LeaguesPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const [leagues, t] = await Promise.all([
    prisma.league.findMany({
      where: { ownerId: session.user.id },
      include: {
        gameTemplate: { select: { name: true } },
        _count: { select: { members: true, playedGames: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    getTranslations({ locale, namespace: 'app.leagues' }),
  ])

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>
        <Link
          href="/app/leagues/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} /> {t('add')}
        </Link>
      </div>

      {leagues.length === 0 ? (
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {leagues.map(league => (
            <li key={league.id}>
              <Link
                href={`/app/leagues/${league.id}`}
                className="block p-4 rounded-2xl transition-colors"
                style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                    <Trophy size={18} style={{ color: '#f5a623' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{league.name}</div>
                    <div className="text-xs font-body mt-0.5" style={{ color: '#9a8878' }}>
                      {league.gameTemplate.name} · {league._count.members} {t('members')} · {league._count.playedGames} {t('playedGames')}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/app/leagues/new/page.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createLeague } from '../actions'
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react'

type GameTemplate = { id: string; name: string }
type Player = { id: string; name: string; avatarSeed: string }
type Step = 1 | 2 | 3

export default function NewLeaguePage() {
  const t = useTranslations('app.leagues.wizard')
  const tPlayers = useTranslations('app.players')
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [gameTemplateId, setGameTemplateId] = useState('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [templates, setTemplates] = useState<GameTemplate[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch templates and players for step dropdowns
    fetch('/api/app/game-templates').then(r => r.json()).then(setTemplates).catch(() => {})
    fetch('/api/app/players').then(r => r.json()).then(setPlayers).catch(() => {})
  }, [])

  function togglePlayer(id: string) {
    setSelectedPlayerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit() {
    setLoading(true)
    const result = await createLeague({ name, description, gameTemplateId, playerIds: selectedPlayerIds })
    setLoading(false)
    if (!result.success) { toast.error(t(result.error as never)); return }
    toast.success(t('leagueCreated' as never))
    router.push(`/app/leagues/${result.id}`)
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-headline font-bold text-xs"
              style={{ background: step >= s ? '#f5a623' : '#e8e1d8', color: step >= s ? '#1c1408' : '#9a8878' }}
            >
              {s}
            </div>
            {s < 3 && <div className="h-px w-8" style={{ background: step > s ? '#f5a623' : '#e8e1d8' }} />}
          </div>
        ))}
        <span className="ml-2 font-headline font-semibold text-sm" style={{ color: '#4a3f2f' }}>
          {step === 1 ? t('step1Title') : step === 2 ? t('step2Title') : t('step3Title')}
        </span>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        {step === 1 && (
          <div className="space-y-4">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              onFocus={e => (e.target.style.borderColor = '#f5a623')}
              onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              className="w-full px-4 py-3 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              onFocus={e => (e.target.style.borderColor = '#f5a623')}
              onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
            />
            {templates.length === 0 ? (
              <p className="text-sm font-body" style={{ color: '#9a8878' }}>{t('noTemplates')}</p>
            ) : (
              <select
                value={gameTemplateId}
                onChange={e => setGameTemplateId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border font-body text-sm"
                style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              >
                <option value="">{t('pickTemplate')}</option>
                {templates.map(tmpl => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm font-body mb-3" style={{ color: '#4a3f2f' }}>{t('pickPlayers')}</p>
            {players.length === 0 ? (
              <p className="text-sm font-body" style={{ color: '#9a8878' }}>{t('noPlayers')}</p>
            ) : (
              <ul className="space-y-2">
                {players.map(player => {
                  const selected = selectedPlayerIds.includes(player.id)
                  return (
                    <li
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                      style={{
                        background: selected ? 'rgba(245,166,35,0.1)' : '#f7f3ed',
                        border: `1px solid ${selected ? '#f5a623' : 'transparent'}`,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center border"
                        style={{
                          borderColor: selected ? '#f5a623' : '#c4b79a',
                          background: selected ? '#f5a623' : 'transparent',
                        }}
                      >
                        {selected && <span className="text-[10px] font-bold" style={{ color: '#1c1408' }}>✓</span>}
                      </div>
                      <span className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{player.name}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                <Trophy size={18} style={{ color: '#f5a623' }} />
              </div>
              <div>
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{name}</div>
                {description && <div className="text-xs font-body mt-0.5" style={{ color: '#9a8878' }}>{description}</div>}
                <div className="text-xs font-body mt-1" style={{ color: '#9a8878' }}>
                  {templates.find(t => t.id === gameTemplateId)?.name} · {selectedPlayerIds.length} players
                </div>
              </div>
            </div>
            <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
              {t('cost')}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button
            onClick={() => setStep(s => (s - 1) as Step)}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f0ebe3', color: '#4a3f2f' }}
          >
            <ChevronLeft size={16} /> {t('back')}
          </button>
        )}
        <div className="flex-1" />
        {step < 3 ? (
          <button
            onClick={() => {
              if (step === 1) {
                if (!name.trim()) { toast.error('Name is required'); return }
                if (!gameTemplateId) { toast.error('Pick a game'); return }
              }
              setStep(s => (s + 1) as Step)
            }}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {t('next')} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {loading ? t('creating') : t('confirm')}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create API routes needed by the league wizard**

The new league wizard fetches `/api/app/game-templates` and `/api/app/players`. Create these:

`src/app/api/app/game-templates/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const templates = await prisma.gameTemplate.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(templates)
}
```

`src/app/api/app/players/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const players = await prisma.player.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, avatarSeed: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(players)
}
```

- [ ] **Step 8: Create `src/app/app/leagues/[id]/page.tsx`**

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Trophy, Plus } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'

export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const [league, t] = await Promise.all([
    prisma.league.findUnique({
      where: { id },
      include: {
        gameTemplate: { select: { name: true, scoringNotes: true } },
        members: {
          include: { player: { select: { id: true, name: true, avatarSeed: true } } },
          orderBy: { createdAt: 'asc' },
        },
        playedGames: {
          include: {
            scores: {
              include: { player: { select: { name: true } } },
              orderBy: { score: 'desc' },
            },
          },
          orderBy: { playedAt: 'desc' },
          take: 20,
        },
      },
    }),
    getTranslations({ locale, namespace: 'app.leagues' }),
  ])

  if (!league || league.ownerId !== session.user.id) notFound()

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
          <Trophy size={22} style={{ color: '#f5a623' }} />
        </div>
        <div className="flex-1">
          <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{league.name}</h1>
          <p className="text-sm font-body" style={{ color: '#9a8878' }}>{league.gameTemplate.name}</p>
        </div>
        <Link
          href={`/app/leagues/${id}/log`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-sm flex-shrink-0"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} /> {t('logGame')}
        </Link>
      </div>

      {/* Members */}
      <section className="mb-8">
        <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{t('members')}</h2>
        <div className="flex flex-wrap gap-2">
          {league.members.map(m => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: '#f0ebe3' }}>
              <Avatar seed={m.player.avatarSeed} name={m.player.name} size={22} />
              <span className="font-headline font-semibold text-xs" style={{ color: '#1c1810' }}>{m.player.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Played games */}
      <section>
        <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{t('playedGames')}</h2>
        {league.playedGames.length === 0 ? (
          <p className="text-sm font-body py-8 text-center" style={{ color: '#9a8878' }}>{t('noGames')}</p>
        ) : (
          <ul className="space-y-3">
            {league.playedGames.map(pg => (
              <li key={pg.id} className="p-4 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <div className="font-headline font-semibold text-xs mb-2" style={{ color: '#9a8878' }}>
                  {new Date(pg.playedAt).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' })}
                </div>
                <ul className="space-y-1">
                  {pg.scores.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="font-headline font-black text-xs w-5" style={{ color: i === 0 ? '#f5a623' : '#c4b79a' }}>#{i + 1}</span>
                      <span className="font-headline font-semibold text-sm flex-1" style={{ color: '#1c1810' }}>{s.player.name}</span>
                      <span className="font-headline font-bold text-sm" style={{ color: '#4a3f2f' }}>{s.score}</span>
                    </li>
                  ))}
                </ul>
                {pg.notes && <p className="text-xs font-body mt-2 italic" style={{ color: '#9a8878' }}>{pg.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 9: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/app/app/leagues/ src/app/api/app/ src/test/leagues-actions.test.ts
git commit -m "feat(leagues): create wizard (10 credits), list page, and detail view"
```

---

## Task 8: PlayedGame Logging

**Files:**
- Create: `src/app/app/leagues/[id]/actions.ts`
- Create: `src/app/app/leagues/[id]/log/page.tsx`
- Add tests to: `src/test/leagues-actions.test.ts`

- [ ] **Step 1: Add PlayedGame tests to `src/test/leagues-actions.test.ts`**

Add these test blocks to the existing file (after the deleteLeague describe block):

```typescript
vi.mock('@/lib/prisma', () => ({
  prisma: {
    league: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    leagueMember: { createMany: vi.fn() },
    playedGame: { create: vi.fn() },
    scoreEntry: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
```

Add this import and test block:

```typescript
import { logPlayedGame } from '@/app/app/leagues/[id]/actions'

describe('logPlayedGame', () => {
  it('deducts credits and creates played game with scores', async () => {
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'lg1', ownerId: 'user-1' } as never)
    vi.mocked(prisma.playedGame.create).mockResolvedValue({ id: 'pg1' } as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([{ id: 'pg1' }] as never)

    const result = await logPlayedGame('lg1', {
      playedAt: new Date('2026-04-19'),
      notes: '',
      scores: [{ playerId: 'p1', score: 42 }, { playerId: 'p2', score: 31 }],
    })

    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 'played_game')
    expect(deductCredits).toHaveBeenCalledWith('user-1', 'played_game', expect.any(Object))
    expect(result).toEqual({ success: true, id: 'pg1' })
  })

  it('rejects logging for a league the user does not own', async () => {
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'lg1', ownerId: 'other' } as never)
    const result = await logPlayedGame('lg1', {
      playedAt: new Date(),
      notes: '',
      scores: [],
    })
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
    expect(deductCredits).not.toHaveBeenCalled()
  })

  it('returns insufficientCredits on InsufficientCreditsError', async () => {
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'lg1', ownerId: 'user-1' } as never)
    const { InsufficientCreditsError } = await import('@/lib/credits')
    vi.mocked(deductCredits).mockRejectedValueOnce(new InsufficientCreditsError())
    const result = await logPlayedGame('lg1', { playedAt: new Date(), notes: '', scores: [] })
    expect(result).toEqual({ success: false, error: 'errors.insufficientCredits' })
  })
})
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
npx vitest run src/test/leagues-actions.test.ts
```

Expected: New tests FAIL — `[id]/actions.ts` does not exist.

- [ ] **Step 3: Create `src/app/app/leagues/[id]/actions.ts`**

```typescript
'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type LogPlayedGameInput = {
  playedAt: Date
  notes: string
  scores: { playerId: string; score: number }[]
}

export async function logPlayedGame(
  leagueId: string,
  input: LogPlayedGameInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.ownerId !== session.user.id) return { success: false, error: 'errors.notFound' }

  try {
    await checkRateLimit(session.user.id, 'played_game')
    await deductCredits(session.user.id, 'played_game', { leagueId, action: 'log_played_game' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'errors.insufficientCredits' }
    return { success: false, error: 'errors.serverError' }
  }

  const [playedGame] = await prisma.$transaction([
    prisma.playedGame.create({
      data: {
        leagueId,
        submittedById: session.user.id,
        playedAt: input.playedAt,
        notes: input.notes.trim() || null,
        status: 'approved',
        scores: {
          create: input.scores.map(s => ({ playerId: s.playerId, score: s.score })),
        },
      },
    }),
  ])

  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true, id: playedGame.id }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/test/leagues-actions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Create `src/app/app/leagues/[id]/log/page.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { logPlayedGame } from '../actions'

type Member = { id: string; player: { id: string; name: string } }

export default function LogGamePage() {
  const t = useTranslations('app.playedGames')
  const tErrors = useTranslations('app.toasts')
  const router = useRouter()
  const { id: leagueId } = useParams<{ id: string }>()

  const [members, setMembers] = useState<Member[]>([])
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/app/leagues/${leagueId}/members`)
      .then(r => r.json())
      .then((data: Member[]) => {
        setMembers(data)
        const initial: Record<string, string> = {}
        data.forEach(m => { initial[m.player.id] = '' })
        setScores(initial)
      })
      .catch(() => {})
  }, [leagueId])

  async function handleSubmit() {
    const scoreEntries = members.map(m => ({
      playerId: m.player.id,
      score: parseInt(scores[m.player.id] ?? '0', 10) || 0,
    }))

    setLoading(true)
    const result = await logPlayedGame(leagueId, {
      playedAt: new Date(playedAt),
      notes,
      scores: scoreEntries,
    })
    setLoading(false)

    if (!result.success) { toast.error(t(result.error as never)); return }
    toast.success(tErrors('gameSaved'))
    router.push(`/app/leagues/${leagueId}`)
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      <h1 className="font-headline font-black text-2xl mb-6" style={{ color: '#1c1810' }}>{t('log')}</h1>

      <div className="space-y-4 p-6 rounded-2xl mb-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        {/* Date */}
        <div>
          <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{t('playedAt')}</label>
          <input
            type="date"
            value={playedAt}
            onChange={e => setPlayedAt(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        </div>

        {/* Scores */}
        <div>
          <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('scores')}</label>
          <ul className="space-y-2">
            {members.map(m => (
              <li key={m.id} className="flex items-center gap-3">
                <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
                <input
                  type="number"
                  value={scores[m.player.id] ?? ''}
                  onChange={e => setScores(prev => ({ ...prev, [m.player.id]: e.target.value }))}
                  placeholder={t('scorePlaceholder')}
                  className="w-28 px-3 py-2 rounded-xl border font-headline font-bold text-sm text-right"
                  style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
                  onFocus={e => (e.target.style.borderColor = '#f5a623')}
                  onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{t('notes')}</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        </div>

        {/* Cost reminder */}
        <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
          {t('cost')}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
        style={{ background: '#f5a623', color: '#1c1408' }}
      >
        {loading ? t('submitting') : t('submit')}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/api/app/leagues/[id]/members/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const league = await prisma.league.findUnique({ where: { id } })
  if (!league || league.ownerId !== session.user.id) return NextResponse.json([], { status: 403 })

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: id },
    include: { player: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(members)
}
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/app/leagues/[id]/ src/app/api/app/leagues/ src/test/leagues-actions.test.ts
git commit -m "feat(played-games): log played game with scores and 5-credit deduction"
```

---

## Task 9: Low-Credit Banner

**Files:**
- Create: `src/components/credits/LowCreditBanner.tsx`
- Modify: `src/app/app/layout.tsx`

- [ ] **Step 1: Create `src/components/credits/LowCreditBanner.tsx`**

```typescript
import Link from 'next/link'

export function LowCreditBanner({ locale }: { locale: string }) {
  const isNl = locale === 'nl'
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 lg:left-64 flex items-center justify-between px-4 py-2"
      style={{ background: '#c47f00', color: '#fff' }}
    >
      <span className="font-headline font-semibold text-xs">
        {isNl ? 'Je credits raken op. Koop meer om te blijven spelen.' : "You're running low on credits. Buy more to keep playing."}
      </span>
      <Link
        href="/app/credits"
        className="px-3 py-1 rounded-lg font-headline font-bold text-xs flex-shrink-0 ml-4"
        style={{ background: 'rgba(255,255,255,0.2)' }}
      >
        {isNl ? 'Credits kopen' : 'Buy Credits'}
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/app/app/layout.tsx` to mount the banner**

In `src/app/app/layout.tsx`, add these imports at the top:

```typescript
import { LowCreditBanner } from '@/components/credits/LowCreditBanner'
```

Then fetch the low-credit threshold and conditionally render the banner. Replace the current `AppLayout` body with:

```typescript
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  setRequestLocale(locale)

  const [user, threshold] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, monthlyCredits: true, permanentCredits: true },
    }),
    prisma.adminSettings.findUnique({ where: { key: 'low_credit_threshold' } }),
  ])
  if (!user) redirect('/en/auth/login')

  const totalCredits = user.monthlyCredits + user.permanentCredits
  const lowThreshold = (threshold?.value as number) ?? 20
  const isLow = totalCredits < lowThreshold

  const messages = await loadMessages(locale)

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {isLow && <LowCreditBanner locale={locale} />}
      <Sidebar email={user.email} credits={totalCredits} />
      <MobileHeader />
      <main
        className="lg:ml-64 min-h-screen relative z-10 pt-14 pb-20 lg:pt-0 lg:pb-0 px-6 lg:px-7"
        style={isLow ? { paddingTop: 'calc(3.5rem + 36px)' } : undefined}
      >
        {children}
      </main>
      <BottomNav />
    </NextIntlClientProvider>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/credits/LowCreditBanner.tsx src/app/app/layout.tsx
git commit -m "feat(credits): low-credit banner when balance below threshold"
```

---

## Task 10: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Phase 2 changelog entry to README**

Find the "Phase changelog" section in `README.md` and add:

```markdown
| Phase 2 | Players CRUD, Game Template wizard (25 cr), League creation (10 cr), PlayedGame logging (5 cr), credit deduction engine (dual-pool), low-credit banner. No new env vars. Run `npx prisma db seed` after migrate to populate AdminSettings. |
```

- [ ] **Step 2: Run the full test suite one final time**

```bash
npx vitest run
```

Expected: All tests PASS. Count should be at least 17 (Phase 1b) + new Phase 2 tests.

- [ ] **Step 3: Final commit + push**

```bash
git add README.md
git commit -m "docs(readme): add Phase 2 changelog entry"
git push origin main
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task |
|---|---|
| Players CRUD | Task 5 |
| Game Template wizard (3-step, 25 credits) | Task 6 |
| League creation (10 credits) | Task 7 |
| PlayedGame logging (5 credits, owner only) | Task 8 |
| Credit deduction (dual-pool monthly/permanent) | Task 3 |
| CreditTransaction log | Task 3 (created in deductCredits) |
| Credit balance in sidebar | Already present in Phase 1b; Task 4 ensures nav is correct |
| Redis rate limiting | Task 3 (checkRateLimit) |
| Low-credit banner | Task 9 |
| Schema: Player, GameTemplate, League, LeagueMember, PlayedGame, ScoreEntry, CreditTransaction, FreePeriod | Task 1 |
| AdminSettings seed (costs, thresholds, free mode) | Task 2 |
| Rename sessions → leagues in nav | Task 4 |
| README no new env vars | Task 10 |

**Placeholder scan:** None — all steps contain actual code.

**Type consistency:** `createLeague`, `logPlayedGame`, `createGameTemplate` return `{ success, error?, id? }` consistently. `deductCredits` returns `{ newMonthly, newPermanent }` everywhere. `InsufficientCreditsError` is imported from `@/lib/credits` in all action files.
