# Log Form — Win Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the session-log form collect the right data for every `WinType`, add an explicit `ScoreEntry.isWinner` flag as the single source of truth for "who won", and update wizard + display sites + actions so the system handles cooperative / team / time / ranking / elimination-order games correctly.

**Architecture:** Schema gains `isWinner` + typed per-type columns on `ScoreEntry`, plus `difficulty` / `teams` / `teamScores` on `PlayedGame` and `trackEliminationOrder` on `GameTemplate`. All winner-determination logic lives in a single pure helper `resolveScoreEntries(template, input)` called from both `logPlayedGame` and `editPlayedGame`. The log form becomes an adaptive tree branching on `winType`. A best-effort SQL backfill sets `isWinner=true` on the top-score entry per existing `PlayedGame`. Aggregator updates to use `isWinner` ride along with phase 10.

**Tech Stack:** Next.js 15 App Router · Prisma 5 · PostgreSQL · next-intl · Vitest · bash / Windows-bash

**Reference spec:** `docs/superpowers/specs/2026-04-23-log-form-win-types-design.md`

**Pre-flight:**
- Work directly on `main` branch (user preference — no PRs, no worktrees)
- Single push at end of plan (Task 12)
- Phase 9 in `docs/superpowers/plans/INDEX.md` — mark `done` on completion
- Pre-existing test failures (14) are NOT introduced here; same baseline expected

---

## File Structure

**New — game logic helper + tests:**
- `src/lib/game-logic/types.ts` — shared input/output types for the resolver
- `src/lib/game-logic/resolveScoreEntries.ts` — the single winType dispatch
- `src/lib/game-logic/resolveScoreEntries.test.ts`
- `src/lib/game-logic/formatTime.ts` — `seconds → display string` per `timeUnit`
- `src/lib/game-logic/formatTime.test.ts`

**Modified — server:**
- `prisma/schema.prisma` — add columns
- `src/app/app/leagues/[id]/actions.ts` — `logPlayedGame` + `editPlayedGame` call the resolver
- `src/app/api/app/leagues/[id]/members/route.ts` — return full template (all relevant fields + member user ids)
- `src/app/api/app/leagues/[id]/sessions/[sessionId]/route.ts` — return all new fields for edit mode
- `src/app/app/games/new/page.tsx` — pass `trackEliminationOrder` on submit
- `src/app/app/games/actions.ts` — accept `trackEliminationOrder`

**Modified — wizard:**
- `src/app/app/games/new/wizard-types.ts` — add field
- `src/app/app/games/new/step3-scoring.tsx` — `trackEliminationOrder` toggle in `elimination` branch

**Modified — log form:**
- `src/app/app/leagues/[id]/log/page.tsx` — full rewrite around adaptive type-branch

**Modified — display:**
- `src/app/app/leagues/[id]/page.tsx` — winType-aware played-games list
- `src/app/app/dashboard/page.tsx` — `loadPlayedGames` uses `isWinner`

**Modified — i18n:**
- `messages/nl/app.json`
- `messages/en/app.json`

**Modified — phase index:**
- `docs/superpowers/plans/INDEX.md`

---

## Task 1: Schema migration + data backfill

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<new>/migration.sql` (auto-generated)

- [ ] **Step 1: Edit `prisma/schema.prisma` — add columns**

Find the `ScoreEntry` model and add:

```prisma
model ScoreEntry {
  id           String     @id @default(cuid())
  playedGameId String
  playedGame   PlayedGame @relation(fields: [playedGameId], references: [id], onDelete: Cascade)
  playerId     String
  player       Player     @relation(fields: [playerId], references: [id])
  score        Int
  isWinner         Boolean @default(false)
  role             String?
  team             String?
  rank             Int?
  eliminationOrder Int?
}
```

Find the `PlayedGame` model and add three fields after `winningMission`:

```prisma
model PlayedGame {
  // ... existing fields up through winningMission ...
  winningMission  String?
  difficulty      String?
  teams           String[]     @default([])
  teamScores      Json?
  shareToken      String?      @unique
  // ... rest stays ...
}
```

Find the `GameTemplate` model and add:

```prisma
model GameTemplate {
  // ... existing fields ...
  trackEliminationOrder Boolean   @default(false)
  // ... rest stays ...
}
```

- [ ] **Step 2: Generate migration**

```bash
npx prisma migrate dev --name log_form_win_types --create-only
```

Expected: new folder under `prisma/migrations/` containing `migration.sql` with `ALTER TABLE` statements (all columns nullable or defaulted).

- [ ] **Step 3: Append data-backfill SQL to the migration**

Open the newly created `prisma/migrations/<timestamp>_log_form_win_types/migration.sql` and append at the end:

```sql
-- Best-effort backfill: mark the highest-scored entry per existing PlayedGame as the winner.
-- Historical time/ranking/winCondition='low' rows may be incorrect; documented limitation.
UPDATE "ScoreEntry"
SET "isWinner" = true
WHERE id IN (
  SELECT DISTINCT ON ("playedGameId") id
  FROM "ScoreEntry"
  ORDER BY "playedGameId", score DESC, id
);
```

- [ ] **Step 4: Apply migration**

```bash
npx prisma migrate dev
```

Expected: migration applies. Verify with `npx prisma studio` or a quick SQL check that `ScoreEntry.isWinner` is `true` for at least one entry per existing `PlayedGame`.

- [ ] **Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test" | head -20
```

Expected: a few errors in `actions.ts` / API routes because they don't know about the new fields yet (those come in later tasks). No errors unrelated to the new fields.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add isWinner + per-type columns; backfill isWinner from score DESC"
```

---

## Task 2: `formatTime` helper + tests (TDD)

**Files:**
- Create: `src/lib/game-logic/formatTime.ts`
- Test: `src/lib/game-logic/formatTime.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/game-logic/formatTime.test.ts
import { describe, it, expect } from 'vitest'
import { formatTime, parseTimeInput } from './formatTime'

describe('formatTime', () => {
  it('formats seconds as bare number + s', () => {
    expect(formatTime(45, 'seconds')).toBe('45s')
  })

  it('formats minutes as decimal minutes', () => {
    expect(formatTime(270, 'minutes')).toBe('4.5 min')
    expect(formatTime(60, 'minutes')).toBe('1.0 min')
  })

  it('formats mmss as M:SS', () => {
    expect(formatTime(270, 'mmss')).toBe('4:30')
    expect(formatTime(65, 'mmss')).toBe('1:05')
    expect(formatTime(3600, 'mmss')).toBe('60:00')
  })

  it('defaults to seconds when unit null', () => {
    expect(formatTime(42, null)).toBe('42s')
  })
})

describe('parseTimeInput', () => {
  it('parses seconds as integer', () => {
    expect(parseTimeInput('45', 'seconds')).toBe(45)
  })

  it('parses minutes decimal to seconds', () => {
    expect(parseTimeInput('4.5', 'minutes')).toBe(270)
    expect(parseTimeInput('1', 'minutes')).toBe(60)
  })

  it('parses mmss as mm:ss tuple', () => {
    expect(parseTimeInput({ mm: '4', ss: '30' }, 'mmss')).toBe(270)
    expect(parseTimeInput({ mm: '0', ss: '9' }, 'mmss')).toBe(9)
  })

  it('returns null for invalid inputs', () => {
    expect(parseTimeInput('', 'seconds')).toBeNull()
    expect(parseTimeInput('abc', 'minutes')).toBeNull()
    expect(parseTimeInput({ mm: '', ss: '' }, 'mmss')).toBeNull()
    expect(parseTimeInput({ mm: '0', ss: '60' }, 'mmss')).toBeNull() // seconds overflow
  })
})
```

- [ ] **Step 2: Run failing**

```bash
npx vitest run src/lib/game-logic/formatTime.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `formatTime.ts`**

```ts
// src/lib/game-logic/formatTime.ts
export type TimeUnit = 'seconds' | 'minutes' | 'mmss' | null

export function formatTime(seconds: number, unit: TimeUnit): string {
  if (unit === 'minutes') return `${(seconds / 60).toFixed(1)} min`
  if (unit === 'mmss') {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${seconds}s`
}

export function parseTimeInput(
  input: string | { mm: string; ss: string },
  unit: TimeUnit,
): number | null {
  if (unit === 'mmss') {
    if (typeof input === 'string') return null
    const mm = parseInt(input.mm, 10)
    const ss = parseInt(input.ss, 10)
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null
    if (mm < 0 || ss < 0 || ss >= 60) return null
    return mm * 60 + ss
  }
  if (typeof input !== 'string') return null
  if (input.trim() === '') return null
  if (unit === 'minutes') {
    const minutes = parseFloat(input)
    if (!Number.isFinite(minutes) || minutes < 0) return null
    return Math.round(minutes * 60)
  }
  // seconds / null
  const secs = parseInt(input, 10)
  if (!Number.isFinite(secs) || secs < 0) return null
  return secs
}
```

- [ ] **Step 4: Run passing**

```bash
npx vitest run src/lib/game-logic/formatTime.test.ts
```

Expected: PASS — all 10 assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game-logic/formatTime.ts src/lib/game-logic/formatTime.test.ts
git commit -m "feat(game-logic): formatTime + parseTimeInput (TDD) — seconds/minutes/mmss"
```

---

## Task 3: `resolveScoreEntries` types

**Files:**
- Create: `src/lib/game-logic/types.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
// src/lib/game-logic/types.ts
import type { WinType } from '@/app/app/games/new/wizard-types'

export type TimeUnit = 'seconds' | 'minutes' | 'mmss' | null

export type ResolverTemplate = {
  winType: WinType
  winCondition: 'high' | 'low' | null
  scoreFields: string[]
  roles: string[]
  missions: string[]
  trackDifficulty: boolean
  trackTeamScores: boolean
  trackEliminationOrder: boolean
  timeUnit: TimeUnit
}

/** Input shape from the log form; supersets of what older form sent. */
export type ResolverInput = {
  // participants always present
  participantIds: string[]

  // per-type inputs (only the relevant ones are populated)
  perPlayerScores?: Record<string, number>            // points-all: sum of fields per player
  winnerId?: string                                   // winner / points-winner / secret-mission / elimination (simple) / team
  winnerScore?: number                                // points-winner
  perPlayerTimeSeconds?: Record<string, number>       // time
  perPlayerRank?: Record<string, number>              // ranking
  perPlayerEliminationOrder?: Record<string, number | null>  // elimination with order (null = last standing)
  perPlayerRole?: Record<string, string | null>       // winner with rolesEnabled
  cooperativeWon?: boolean                            // cooperative
  difficulty?: string                                 // cooperative (trackDifficulty)
  teamAssignments?: Record<string, string>            // team: playerId → team name
  teams?: string[]                                    // team: team names
  winningTeam?: string                                // team
  perTeamScores?: Record<string, number>              // team (trackTeamScores)
  winningMission?: string                             // secret-mission
}

export type ResolvedScoreEntry = {
  playerId: string
  score: number
  isWinner: boolean
  role: string | null
  team: string | null
  rank: number | null
  eliminationOrder: number | null
}

export type ResolvedExtras = {
  winningMission: string | null
  difficulty: string | null
  teams: string[]
  teamScores: { name: string; score: number }[] | null
}

export type ResolverError =
  | 'missingWinner'
  | 'missingScore'
  | 'missingTime'
  | 'invalidRanks'
  | 'invalidEliminationOrder'
  | 'missingTeamAssignment'
  | 'missingWinningTeam'
  | 'missingCooperativeResult'
  | 'missingMission'

export type ResolverResult =
  | { ok: true; scoreEntries: ResolvedScoreEntry[]; extras: ResolvedExtras }
  | { ok: false; error: ResolverError }
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "game-logic/types"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/game-logic/types.ts
git commit -m "feat(game-logic): ResolverTemplate/Input/Result types"
```

---

## Task 4: `resolveScoreEntries` implementation (TDD)

**Files:**
- Create: `src/lib/game-logic/resolveScoreEntries.ts`
- Test: `src/lib/game-logic/resolveScoreEntries.test.ts`

Write the test file first, one `describe` per winType, then implement. This is one commit per winType pair (test + impl) to keep the feedback loop tight.

- [ ] **Step 1: Test skeleton + helpers**

```ts
// src/lib/game-logic/resolveScoreEntries.test.ts
import { describe, it, expect } from 'vitest'
import { resolveScoreEntries } from './resolveScoreEntries'
import type { ResolverTemplate, ResolverInput } from './types'

function template(overrides: Partial<ResolverTemplate>): ResolverTemplate {
  return {
    winType: 'winner',
    winCondition: null,
    scoreFields: [],
    roles: [],
    missions: [],
    trackDifficulty: false,
    trackTeamScores: false,
    trackEliminationOrder: false,
    timeUnit: null,
    ...overrides,
  }
}

function input(overrides: Partial<ResolverInput>): ResolverInput {
  return { participantIds: ['p1', 'p2'], ...overrides }
}

// tests per winType follow
```

- [ ] **Step 2: Test + implement `winner` (simplest)**

Test block:

```ts
describe('winner', () => {
  it('requires winnerId', () => {
    const r = resolveScoreEntries(template({ winType: 'winner' }), input({}))
    expect(r).toEqual({ ok: false, error: 'missingWinner' })
  })

  it('marks winner and losers correctly', () => {
    const r = resolveScoreEntries(
      template({ winType: 'winner' }),
      input({ winnerId: 'p1' }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.scoreEntries).toEqual([
      { playerId: 'p1', score: 1, isWinner: true, role: null, team: null, rank: null, eliminationOrder: null },
      { playerId: 'p2', score: 0, isWinner: false, role: null, team: null, rank: null, eliminationOrder: null },
    ])
    expect(r.extras).toEqual({ winningMission: null, difficulty: null, teams: [], teamScores: null })
  })

  it('attaches roles when rolesEnabled', () => {
    const r = resolveScoreEntries(
      template({ winType: 'winner', roles: ['Mage', 'Warrior'] }),
      input({ winnerId: 'p1', perPlayerRole: { p1: 'Mage', p2: 'Warrior' } }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.scoreEntries[0].role).toBe('Mage')
    expect(r.scoreEntries[1].role).toBe('Warrior')
  })
})
```

Implementation — create `resolveScoreEntries.ts` with skeleton + `winner` branch:

```ts
// src/lib/game-logic/resolveScoreEntries.ts
import type {
  ResolverTemplate,
  ResolverInput,
  ResolverResult,
  ResolvedScoreEntry,
  ResolvedExtras,
} from './types'

function emptyExtras(): ResolvedExtras {
  return { winningMission: null, difficulty: null, teams: [], teamScores: null }
}

function blankEntry(playerId: string, score: number, isWinner: boolean): ResolvedScoreEntry {
  return { playerId, score, isWinner, role: null, team: null, rank: null, eliminationOrder: null }
}

export function resolveScoreEntries(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  switch (template.winType) {
    case 'winner':
      return resolveWinner(template, input)
    default:
      return { ok: false, error: 'missingWinner' }  // temporary — fills in as tasks proceed
  }
}

function resolveWinner(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  if (!input.winnerId || !input.participantIds.includes(input.winnerId)) {
    return { ok: false, error: 'missingWinner' }
  }
  const entries = input.participantIds.map(pid => {
    const isWinner = pid === input.winnerId
    const entry = blankEntry(pid, isWinner ? 1 : 0, isWinner)
    if (template.roles.length > 0) {
      entry.role = input.perPlayerRole?.[pid] ?? null
    }
    return entry
  })
  return { ok: true, scoreEntries: entries, extras: emptyExtras() }
}
```

Run: `npx vitest run src/lib/game-logic/resolveScoreEntries.test.ts`. Expected: winner tests PASS (skip everything else that isn't written yet).

Commit:

```bash
git add src/lib/game-logic/resolveScoreEntries.ts src/lib/game-logic/resolveScoreEntries.test.ts
git commit -m "feat(game-logic): resolveScoreEntries — winner branch (TDD)"
```

- [ ] **Step 3: Test + implement `secret-mission`**

Add to test file:

```ts
describe('secret-mission', () => {
  it('requires winnerId and winningMission', () => {
    expect(resolveScoreEntries(
      template({ winType: 'secret-mission', missions: ['Flag', 'Citadel'] }),
      input({ winnerId: 'p1' }),
    )).toEqual({ ok: false, error: 'missingMission' })

    expect(resolveScoreEntries(
      template({ winType: 'secret-mission', missions: ['Flag'] }),
      input({ winningMission: 'Flag' }),
    )).toEqual({ ok: false, error: 'missingWinner' })
  })

  it('returns entries + winningMission in extras', () => {
    const r = resolveScoreEntries(
      template({ winType: 'secret-mission', missions: ['Flag'] }),
      input({ winnerId: 'p1', winningMission: 'Flag' }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.scoreEntries[0].isWinner).toBe(true)
    expect(r.extras.winningMission).toBe('Flag')
  })
})
```

Add branch to `resolveScoreEntries.ts`:

```ts
// inside the switch
case 'secret-mission':
  return resolveSecretMission(template, input)

// new function
function resolveSecretMission(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  if (!input.winnerId || !input.participantIds.includes(input.winnerId)) {
    return { ok: false, error: 'missingWinner' }
  }
  if (!input.winningMission || !template.missions.includes(input.winningMission)) {
    return { ok: false, error: 'missingMission' }
  }
  const entries = input.participantIds.map(pid =>
    blankEntry(pid, pid === input.winnerId ? 1 : 0, pid === input.winnerId),
  )
  return { ok: true, scoreEntries: entries, extras: { ...emptyExtras(), winningMission: input.winningMission } }
}
```

Run tests + commit:

```bash
git add src/lib/game-logic/resolveScoreEntries.ts src/lib/game-logic/resolveScoreEntries.test.ts
git commit -m "feat(game-logic): resolveScoreEntries — secret-mission branch"
```

- [ ] **Step 4: Test + implement `points-all`**

Test:

```ts
describe('points-all', () => {
  it('picks highest sum as winner (default winCondition high)', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-all', winCondition: 'high', scoreFields: ['resources', 'vp'] }),
      input({ perPlayerScores: { p1: 15, p2: 22 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p2')!.isWinner).toBe(true)
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.isWinner).toBe(false)
    expect(r.scoreEntries.find(s => s.playerId === 'p2')!.score).toBe(22)
  })

  it('picks lowest sum when winCondition=low', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-all', winCondition: 'low' }),
      input({ perPlayerScores: { p1: 5, p2: 12 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.isWinner).toBe(true)
  })

  it('ties share winner flag', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-all', winCondition: 'high' }),
      input({ perPlayerScores: { p1: 10, p2: 10 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.every(s => s.isWinner)).toBe(true)
  })

  it('returns missingScore when any participant has no score', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-all' }),
      input({ perPlayerScores: { p1: 10 } }),
    )
    expect(r).toEqual({ ok: false, error: 'missingScore' })
  })
})
```

Implementation:

```ts
// switch
case 'points-all':
  return resolvePointsAll(template, input)

function resolvePointsAll(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  const scores = input.perPlayerScores ?? {}
  for (const pid of input.participantIds) {
    if (!(pid in scores)) return { ok: false, error: 'missingScore' }
  }
  const winnerScoreTarget = template.winCondition === 'low'
    ? Math.min(...input.participantIds.map(p => scores[p]))
    : Math.max(...input.participantIds.map(p => scores[p]))
  const entries = input.participantIds.map(pid =>
    blankEntry(pid, scores[pid], scores[pid] === winnerScoreTarget),
  )
  return { ok: true, scoreEntries: entries, extras: emptyExtras() }
}
```

Run + commit:

```bash
git add src/lib/game-logic/
git commit -m "feat(game-logic): resolveScoreEntries — points-all respects winCondition"
```

- [ ] **Step 5: Test + implement `points-winner`**

Test:

```ts
describe('points-winner', () => {
  it('requires winnerId', () => {
    expect(resolveScoreEntries(
      template({ winType: 'points-winner' }),
      input({ winnerScore: 47 }),
    )).toEqual({ ok: false, error: 'missingWinner' })
  })

  it('winner gets entered score, others 0', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-winner' }),
      input({ winnerId: 'p1', winnerScore: 47 }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')).toMatchObject({ score: 47, isWinner: true })
    expect(r.scoreEntries.find(s => s.playerId === 'p2')).toMatchObject({ score: 0, isWinner: false })
  })

  it('treats missing winnerScore as 0', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-winner' }),
      input({ winnerId: 'p1' }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.score).toBe(0)
  })
})
```

Implementation:

```ts
// switch
case 'points-winner':
  return resolvePointsWinner(template, input)

function resolvePointsWinner(_template: ResolverTemplate, input: ResolverInput): ResolverResult {
  if (!input.winnerId || !input.participantIds.includes(input.winnerId)) {
    return { ok: false, error: 'missingWinner' }
  }
  const winnerScore = input.winnerScore ?? 0
  const entries = input.participantIds.map(pid => {
    const isWinner = pid === input.winnerId
    return blankEntry(pid, isWinner ? winnerScore : 0, isWinner)
  })
  return { ok: true, scoreEntries: entries, extras: emptyExtras() }
}
```

Commit:

```bash
git add src/lib/game-logic/
git commit -m "feat(game-logic): resolveScoreEntries — points-winner"
```

- [ ] **Step 6: Test + implement `time`**

Test:

```ts
describe('time', () => {
  it('fastest (lowest seconds) wins by default', () => {
    const r = resolveScoreEntries(
      template({ winType: 'time', timeUnit: 'mmss', winCondition: 'low' }),
      input({ perPlayerTimeSeconds: { p1: 270, p2: 340 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.isWinner).toBe(true)
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.score).toBe(270)
  })

  it('slowest wins when winCondition=high', () => {
    const r = resolveScoreEntries(
      template({ winType: 'time', winCondition: 'high' }),
      input({ perPlayerTimeSeconds: { p1: 270, p2: 340 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p2')!.isWinner).toBe(true)
  })

  it('ties share winner flag', () => {
    const r = resolveScoreEntries(
      template({ winType: 'time', winCondition: 'low' }),
      input({ perPlayerTimeSeconds: { p1: 300, p2: 300 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.every(s => s.isWinner)).toBe(true)
  })

  it('missing time returns error', () => {
    expect(resolveScoreEntries(
      template({ winType: 'time' }),
      input({ perPlayerTimeSeconds: { p1: 100 } }),
    )).toEqual({ ok: false, error: 'missingTime' })
  })
})
```

Implementation:

```ts
// switch
case 'time':
  return resolveTime(template, input)

function resolveTime(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  const times = input.perPlayerTimeSeconds ?? {}
  for (const pid of input.participantIds) {
    if (!(pid in times)) return { ok: false, error: 'missingTime' }
  }
  const winnerTarget = template.winCondition === 'high'
    ? Math.max(...input.participantIds.map(p => times[p]))
    : Math.min(...input.participantIds.map(p => times[p]))
  const entries = input.participantIds.map(pid =>
    blankEntry(pid, times[pid], times[pid] === winnerTarget),
  )
  return { ok: true, scoreEntries: entries, extras: emptyExtras() }
}
```

Commit:

```bash
git add src/lib/game-logic/
git commit -m "feat(game-logic): resolveScoreEntries — time (fastest-wins default)"
```

- [ ] **Step 7: Test + implement `ranking`**

Test:

```ts
describe('ranking', () => {
  it('rank 1 is the winner, score is inverted for sort compat', () => {
    const r = resolveScoreEntries(
      template({ winType: 'ranking' }),
      input({ participantIds: ['p1', 'p2', 'p3'], perPlayerRank: { p1: 2, p2: 1, p3: 3 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    const byId = Object.fromEntries(r.scoreEntries.map(e => [e.playerId, e]))
    expect(byId.p2).toMatchObject({ rank: 1, isWinner: true, score: 3 })  // N+1-1 = 3
    expect(byId.p1).toMatchObject({ rank: 2, isWinner: false, score: 2 })
    expect(byId.p3).toMatchObject({ rank: 3, isWinner: false, score: 1 })
  })

  it('returns invalidRanks when ranks are not unique 1..N', () => {
    expect(resolveScoreEntries(
      template({ winType: 'ranking' }),
      input({ participantIds: ['p1', 'p2'], perPlayerRank: { p1: 1, p2: 1 } }),
    )).toEqual({ ok: false, error: 'invalidRanks' })

    expect(resolveScoreEntries(
      template({ winType: 'ranking' }),
      input({ participantIds: ['p1', 'p2'], perPlayerRank: { p1: 1, p2: 3 } }),
    )).toEqual({ ok: false, error: 'invalidRanks' })

    expect(resolveScoreEntries(
      template({ winType: 'ranking' }),
      input({ participantIds: ['p1', 'p2'], perPlayerRank: { p1: 1 } }),
    )).toEqual({ ok: false, error: 'invalidRanks' })
  })
})
```

Implementation:

```ts
// switch
case 'ranking':
  return resolveRanking(template, input)

function resolveRanking(_template: ResolverTemplate, input: ResolverInput): ResolverResult {
  const ranks = input.perPlayerRank ?? {}
  const n = input.participantIds.length
  const expectedSet = new Set(Array.from({ length: n }, (_, i) => i + 1))
  const seen = new Set<number>()
  for (const pid of input.participantIds) {
    const r = ranks[pid]
    if (!Number.isInteger(r) || r < 1 || r > n || seen.has(r)) {
      return { ok: false, error: 'invalidRanks' }
    }
    seen.add(r)
  }
  // all expected ranks present
  for (const want of expectedSet) if (!seen.has(want)) return { ok: false, error: 'invalidRanks' }

  const entries = input.participantIds.map(pid => {
    const rank = ranks[pid]
    const entry = blankEntry(pid, n + 1 - rank, rank === 1)
    entry.rank = rank
    return entry
  })
  return { ok: true, scoreEntries: entries, extras: emptyExtras() }
}
```

Commit:

```bash
git add src/lib/game-logic/
git commit -m "feat(game-logic): resolveScoreEntries — ranking with validation"
```

- [ ] **Step 8: Test + implement `elimination`**

Test:

```ts
describe('elimination', () => {
  it('without order: requires winnerId, score 1/0', () => {
    expect(resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: false }),
      input({}),
    )).toEqual({ ok: false, error: 'missingWinner' })

    const r = resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: false }),
      input({ winnerId: 'p1' }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.isWinner).toBe(true)
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.eliminationOrder).toBeNull()
  })

  it('with order: player with null order is winner', () => {
    const r = resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: true }),
      input({
        participantIds: ['p1', 'p2', 'p3'],
        perPlayerEliminationOrder: { p1: 1, p2: null, p3: 2 },
      }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    const byId = Object.fromEntries(r.scoreEntries.map(e => [e.playerId, e]))
    expect(byId.p2).toMatchObject({ isWinner: true, eliminationOrder: null, score: 1 })
    expect(byId.p1).toMatchObject({ isWinner: false, eliminationOrder: 1, score: 0 })
    expect(byId.p3).toMatchObject({ isWinner: false, eliminationOrder: 2, score: 0 })
  })

  it('with order: rejects more than one null, non-unique orders, out-of-range', () => {
    expect(resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: true }),
      input({ participantIds: ['p1', 'p2'], perPlayerEliminationOrder: { p1: null, p2: null } }),
    )).toEqual({ ok: false, error: 'invalidEliminationOrder' })

    expect(resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: true }),
      input({ participantIds: ['p1', 'p2', 'p3'], perPlayerEliminationOrder: { p1: 1, p2: 1, p3: null } }),
    )).toEqual({ ok: false, error: 'invalidEliminationOrder' })

    expect(resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: true }),
      input({ participantIds: ['p1', 'p2'], perPlayerEliminationOrder: { p1: 5, p2: null } }),
    )).toEqual({ ok: false, error: 'invalidEliminationOrder' })
  })
})
```

Implementation:

```ts
// switch
case 'elimination':
  return resolveElimination(template, input)

function resolveElimination(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  if (!template.trackEliminationOrder) {
    if (!input.winnerId || !input.participantIds.includes(input.winnerId)) {
      return { ok: false, error: 'missingWinner' }
    }
    const entries = input.participantIds.map(pid => {
      const isWinner = pid === input.winnerId
      return blankEntry(pid, isWinner ? 1 : 0, isWinner)
    })
    return { ok: true, scoreEntries: entries, extras: emptyExtras() }
  }

  // with order
  const order = input.perPlayerEliminationOrder ?? {}
  const n = input.participantIds.length
  const filled: { pid: string; order: number }[] = []
  const nulls: string[] = []
  for (const pid of input.participantIds) {
    const v = order[pid]
    if (v == null) nulls.push(pid)
    else filled.push({ pid, order: v })
  }
  if (nulls.length !== 1) return { ok: false, error: 'invalidEliminationOrder' }
  // filled values must be unique integers in 1..N-1
  const seen = new Set<number>()
  for (const { order: v } of filled) {
    if (!Number.isInteger(v) || v < 1 || v > n - 1 || seen.has(v)) {
      return { ok: false, error: 'invalidEliminationOrder' }
    }
    seen.add(v)
  }

  const winnerId = nulls[0]
  const entries = input.participantIds.map(pid => {
    const isWinner = pid === winnerId
    const entry = blankEntry(pid, isWinner ? 1 : 0, isWinner)
    entry.eliminationOrder = isWinner ? null : order[pid]!
    return entry
  })
  return { ok: true, scoreEntries: entries, extras: emptyExtras() }
}
```

Commit:

```bash
git add src/lib/game-logic/
git commit -m "feat(game-logic): resolveScoreEntries — elimination with optional order"
```

- [ ] **Step 9: Test + implement `cooperative`**

Test:

```ts
describe('cooperative', () => {
  it('requires cooperativeWon boolean', () => {
    expect(resolveScoreEntries(
      template({ winType: 'cooperative' }),
      input({}),
    )).toEqual({ ok: false, error: 'missingCooperativeResult' })
  })

  it('all participants win when team wins', () => {
    const r = resolveScoreEntries(
      template({ winType: 'cooperative' }),
      input({ cooperativeWon: true }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.every(s => s.isWinner && s.score === 1)).toBe(true)
  })

  it('all participants lose when team loses', () => {
    const r = resolveScoreEntries(
      template({ winType: 'cooperative' }),
      input({ cooperativeWon: false }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.every(s => !s.isWinner && s.score === 0)).toBe(true)
  })

  it('records difficulty when trackDifficulty', () => {
    const r = resolveScoreEntries(
      template({ winType: 'cooperative', trackDifficulty: true }),
      input({ cooperativeWon: true, difficulty: 'hard' }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.extras.difficulty).toBe('hard')
  })

  it('ignores difficulty field when trackDifficulty=false', () => {
    const r = resolveScoreEntries(
      template({ winType: 'cooperative', trackDifficulty: false }),
      input({ cooperativeWon: true, difficulty: 'hard' }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.extras.difficulty).toBeNull()
  })
})
```

Implementation:

```ts
// switch
case 'cooperative':
  return resolveCooperative(template, input)

function resolveCooperative(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  if (typeof input.cooperativeWon !== 'boolean') {
    return { ok: false, error: 'missingCooperativeResult' }
  }
  const won = input.cooperativeWon
  const entries = input.participantIds.map(pid => blankEntry(pid, won ? 1 : 0, won))
  const difficulty = template.trackDifficulty ? (input.difficulty?.trim() || null) : null
  return { ok: true, scoreEntries: entries, extras: { ...emptyExtras(), difficulty } }
}
```

Commit:

```bash
git add src/lib/game-logic/
git commit -m "feat(game-logic): resolveScoreEntries — cooperative with optional difficulty"
```

- [ ] **Step 10: Test + implement `team`**

Test:

```ts
describe('team', () => {
  const templ = () => template({ winType: 'team' })
  const base = (overrides: Partial<ResolverInput>) =>
    input({ participantIds: ['p1', 'p2', 'p3', 'p4'], ...overrides })

  it('requires team assignment for every participant', () => {
    expect(resolveScoreEntries(templ(), base({
      teams: ['Red', 'Blue'],
      teamAssignments: { p1: 'Red' },  // p2 p3 p4 missing
      winningTeam: 'Red',
    }))).toEqual({ ok: false, error: 'missingTeamAssignment' })
  })

  it('requires winningTeam to be a listed team', () => {
    expect(resolveScoreEntries(templ(), base({
      teams: ['Red', 'Blue'],
      teamAssignments: { p1: 'Red', p2: 'Red', p3: 'Blue', p4: 'Blue' },
      winningTeam: 'Green',
    }))).toEqual({ ok: false, error: 'missingWinningTeam' })
  })

  it('everyone on winning team gets isWinner', () => {
    const r = resolveScoreEntries(templ(), base({
      teams: ['Red', 'Blue'],
      teamAssignments: { p1: 'Red', p2: 'Red', p3: 'Blue', p4: 'Blue' },
      winningTeam: 'Red',
    }))
    expect(r.ok).toBe(true); if (!r.ok) return
    const byId = Object.fromEntries(r.scoreEntries.map(e => [e.playerId, e]))
    expect(byId.p1).toMatchObject({ team: 'Red', isWinner: true })
    expect(byId.p2).toMatchObject({ team: 'Red', isWinner: true })
    expect(byId.p3).toMatchObject({ team: 'Blue', isWinner: false })
    expect(byId.p4).toMatchObject({ team: 'Blue', isWinner: false })
    expect(r.extras.teams).toEqual(['Red', 'Blue'])
    expect(r.extras.teamScores).toBeNull()
  })

  it('records teamScores when trackTeamScores', () => {
    const r = resolveScoreEntries(
      template({ winType: 'team', trackTeamScores: true }),
      base({
        teams: ['Red', 'Blue'],
        teamAssignments: { p1: 'Red', p2: 'Red', p3: 'Blue', p4: 'Blue' },
        winningTeam: 'Red',
        perTeamScores: { Red: 12, Blue: 8 },
      }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.extras.teamScores).toEqual([{ name: 'Red', score: 12 }, { name: 'Blue', score: 8 }])
  })
})
```

Implementation:

```ts
// switch
case 'team':
  return resolveTeam(template, input)

function resolveTeam(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  const teams = input.teams ?? []
  const assignments = input.teamAssignments ?? {}
  for (const pid of input.participantIds) {
    if (!assignments[pid]) return { ok: false, error: 'missingTeamAssignment' }
    if (!teams.includes(assignments[pid])) return { ok: false, error: 'missingTeamAssignment' }
  }
  if (!input.winningTeam || !teams.includes(input.winningTeam)) {
    return { ok: false, error: 'missingWinningTeam' }
  }

  const entries = input.participantIds.map(pid => {
    const team = assignments[pid]
    const isWinner = team === input.winningTeam
    const entry = blankEntry(pid, isWinner ? 1 : 0, isWinner)
    entry.team = team
    return entry
  })

  const teamScores = template.trackTeamScores && input.perTeamScores
    ? teams.map(name => ({ name, score: input.perTeamScores![name] ?? 0 }))
    : null

  return { ok: true, scoreEntries: entries, extras: { ...emptyExtras(), teams, teamScores } }
}
```

Commit:

```bash
git add src/lib/game-logic/
git commit -m "feat(game-logic): resolveScoreEntries — team with assignments + optional team scores"
```

- [ ] **Step 11: Replace the temporary default case + full test suite**

Update the `switch` default to be exhaustive. Replace:

```ts
    default:
      return { ok: false, error: 'missingWinner' }  // temporary
```

with:

```ts
  }
  // Exhaustiveness — if a new winType is added, TypeScript will flag here.
  const _exhaustive: never = template.winType
  throw new Error(`resolveScoreEntries: unhandled winType ${_exhaustive}`)
```

Run full suite:

```bash
npx vitest run src/lib/game-logic/
```

Expected: all tests pass.

Commit:

```bash
git add src/lib/game-logic/resolveScoreEntries.ts
git commit -m "feat(game-logic): resolveScoreEntries — exhaustive winType switch"
```

---

## Task 5: Wire `resolveScoreEntries` into `logPlayedGame` + `editPlayedGame`

**Files:**
- Modify: `src/app/app/leagues/[id]/actions.ts`

- [ ] **Step 1: Replace `LogPlayedGameInput` + `EditPlayedGameInput` with the richer shape**

```ts
// near top of actions.ts
import { resolveScoreEntries } from '@/lib/game-logic/resolveScoreEntries'
import type { ResolverInput } from '@/lib/game-logic/types'

type LogPlayedGameInput = {
  playedAt: Date
  notes: string
  resolverInput: ResolverInput
}

type EditPlayedGameInput = {
  playedAt: Date
  notes: string
  resolverInput: ResolverInput
}
```

- [ ] **Step 2: Rewrite `logPlayedGame`**

```ts
export async function logPlayedGame(
  leagueId: string,
  input: LogPlayedGameInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { gameTemplate: true },
  })
  if (!league || league.ownerId !== session.user.id) return { success: false, error: 'notFound' }

  const resolved = resolveScoreEntries(
    {
      winType: league.gameTemplate.winType as never,
      winCondition: league.gameTemplate.winCondition as 'high' | 'low' | null,
      scoreFields: league.gameTemplate.scoreFields,
      roles: league.gameTemplate.roles,
      missions: league.gameTemplate.missions,
      trackDifficulty: league.gameTemplate.trackDifficulty,
      trackTeamScores: league.gameTemplate.trackTeamScores,
      trackEliminationOrder: league.gameTemplate.trackEliminationOrder,
      timeUnit: league.gameTemplate.timeUnit as never,
    },
    input.resolverInput,
  )
  if (!resolved.ok) return { success: false, error: resolved.error }

  try {
    await checkRateLimit(session.user.id, 'played_game')
    await deductCredits(session.user.id, 'played_game', { leagueId, action: 'log_played_game' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'insufficientCredits' }
    return { success: false, error: 'serverError' }
  }

  const [playedGame] = await prisma.$transaction([
    prisma.playedGame.create({
      data: {
        leagueId,
        submittedById: session.user.id,
        playedAt: input.playedAt,
        notes: input.notes.trim() || null,
        winningMission: resolved.extras.winningMission,
        difficulty: resolved.extras.difficulty,
        teams: resolved.extras.teams,
        teamScores: resolved.extras.teamScores ?? undefined,
        status: 'approved',
        shareToken: crypto.randomUUID(),
        scores: {
          create: resolved.scoreEntries.map(e => ({
            playerId: e.playerId,
            score: e.score,
            isWinner: e.isWinner,
            role: e.role,
            team: e.team,
            rank: e.rank,
            eliminationOrder: e.eliminationOrder,
          })),
        },
      },
    }),
  ])

  await redis.del(`cache:dashboard:${session.user.id}`)
  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true, id: playedGame.id }
}
```

- [ ] **Step 3: Rewrite `editPlayedGame`**

```ts
export async function editPlayedGame(
  playedGameId: string,
  leagueId: string,
  input: EditPlayedGameInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId, leagueId },
    include: {
      league: { select: { ownerId: true, gameTemplate: true } },
    },
  })
  if (!pg || pg.league.ownerId !== session.user.id) return { success: false, error: 'notFound' }

  const resolved = resolveScoreEntries(
    {
      winType: pg.league.gameTemplate.winType as never,
      winCondition: pg.league.gameTemplate.winCondition as 'high' | 'low' | null,
      scoreFields: pg.league.gameTemplate.scoreFields,
      roles: pg.league.gameTemplate.roles,
      missions: pg.league.gameTemplate.missions,
      trackDifficulty: pg.league.gameTemplate.trackDifficulty,
      trackTeamScores: pg.league.gameTemplate.trackTeamScores,
      trackEliminationOrder: pg.league.gameTemplate.trackEliminationOrder,
      timeUnit: pg.league.gameTemplate.timeUnit as never,
    },
    input.resolverInput,
  )
  if (!resolved.ok) return { success: false, error: resolved.error }

  await prisma.$transaction([
    prisma.scoreEntry.deleteMany({ where: { playedGameId } }),
    prisma.playedGame.update({
      where: { id: playedGameId },
      data: {
        playedAt: input.playedAt,
        notes: input.notes.trim() || null,
        winningMission: resolved.extras.winningMission,
        difficulty: resolved.extras.difficulty,
        teams: resolved.extras.teams,
        teamScores: resolved.extras.teamScores ?? undefined,
      },
    }),
    prisma.scoreEntry.createMany({
      data: resolved.scoreEntries.map(e => ({
        playedGameId,
        playerId: e.playerId,
        score: e.score,
        isWinner: e.isWinner,
        role: e.role,
        team: e.team,
        rank: e.rank,
        eliminationOrder: e.eliminationOrder,
      })),
    }),
  ])

  await redis.del(`cache:dashboard:${session.user.id}`)
  if (pg.submittedById !== session.user.id) await redis.del(`cache:dashboard:${pg.submittedById}`)
  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true }
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test" | head -20
```

Expected: the log-form callers (`src/app/app/leagues/[id]/log/page.tsx`) now fail to typecheck because they send the old shape. That's fine — Task 9 rewrites the caller. Still: no unexpected errors anywhere else.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/leagues/[id]/actions.ts
git commit -m "feat(actions): route logPlayedGame + editPlayedGame through resolveScoreEntries"
```

---

## Task 6: Update `/api/app/leagues/[id]/members` route

**Files:**
- Modify: `src/app/api/app/leagues/[id]/members/route.ts`

- [ ] **Step 1: Return the full template + member userIds**

```ts
// src/app/api/app/leagues/[id]/members/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      gameTemplate: {
        select: {
          winType: true,
          winCondition: true,
          scoreFields: true,
          roles: true,
          missions: true,
          minPlayers: true,
          maxPlayers: true,
          trackDifficulty: true,
          trackTeamScores: true,
          trackEliminationOrder: true,
          timeUnit: true,
        },
      },
    },
  })
  if (!league || league.ownerId !== session.user.id) return NextResponse.json([], { status: 403 })

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: id },
    include: { player: { select: { id: true, name: true, userId: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    members,
    template: league.gameTemplate,
  })
}
```

(The old separate `winType`, `missions`, etc. fields at the top level are folded under `template`. The log form consumer in Task 9 will read `template.*`.)

- [ ] **Step 2: Commit**

```bash
git add src/app/api/app/leagues/[id]/members/route.ts
git commit -m "feat(api): /leagues/:id/members returns full gameTemplate"
```

---

## Task 7: Update `/api/app/leagues/[id]/sessions/[sessionId]` route (edit-mode hydration)

**Files:**
- Modify: `src/app/api/app/leagues/[id]/sessions/[sessionId]/route.ts`

- [ ] **Step 1: Rewrite to expose all new fields**

```ts
// src/app/api/app/leagues/[id]/sessions/[sessionId]/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { id, sessionId } = await params
  const session = await auth()
  if (!session) return NextResponse.json(null, { status: 401 })

  const league = await prisma.league.findUnique({ where: { id } })
  if (!league || league.ownerId !== session.user.id) return NextResponse.json(null, { status: 403 })

  const pg = await prisma.playedGame.findUnique({
    where: { id: sessionId, leagueId: id },
    include: { scores: { include: { player: { select: { id: true } } } } },
  })
  if (!pg) return NextResponse.json(null, { status: 404 })

  const d = pg.playedAt
  const pad = (n: number) => String(n).padStart(2, '0')
  const playedAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

  const winner = pg.scores.find(s => s.isWinner)

  return NextResponse.json({
    playedAt: playedAtLocal,
    notes: pg.notes ?? '',
    winningMission: pg.winningMission ?? '',
    difficulty: pg.difficulty ?? '',
    teams: pg.teams,
    teamScores: pg.teamScores,
    participantIds: pg.scores.map(s => s.playerId),
    winnerId: winner?.playerId ?? '',
    scores: pg.scores.map(s => ({
      playerId: s.playerId,
      score: s.score,
      isWinner: s.isWinner,
      role: s.role,
      team: s.team,
      rank: s.rank,
      eliminationOrder: s.eliminationOrder,
    })),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/app/leagues/[id]/sessions/[sessionId]/route.ts
git commit -m "feat(api): /sessions/:id returns all new fields + isWinner-derived winnerId"
```

---

## Task 8: Wizard `trackEliminationOrder` toggle

**Files:**
- Modify: `src/app/app/games/new/wizard-types.ts`
- Modify: `src/app/app/games/new/step3-scoring.tsx`
- Modify: `src/app/app/games/new/page.tsx`
- Modify: `src/app/app/games/actions.ts`

- [ ] **Step 1: Add `trackEliminationOrder` to wizard state**

In `wizard-types.ts`, inside `WizardState`:

```ts
trackEliminationOrder: boolean
```

And in `INITIAL_WIZARD_STATE`:

```ts
trackEliminationOrder: false,
```

- [ ] **Step 2: Add toggle to `step3-scoring.tsx` (elimination branch)**

Replace the existing elimination branch:

```tsx
  if (wt === 'elimination') {
    return <p className="font-body text-sm leading-relaxed" style={{ color: '#9a8878' }}>{t('eliminationInfo')}</p>
  }
```

with:

```tsx
  if (wt === 'elimination') {
    return (
      <div className="space-y-4">
        <p className="font-body text-sm leading-relaxed" style={{ color: '#9a8878' }}>{t('eliminationInfo')}</p>
        <Toggle
          value={state.trackEliminationOrder}
          onToggle={() => onChange({ trackEliminationOrder: !state.trackEliminationOrder })}
          label={t('trackEliminationOrderToggle')}
        />
      </div>
    )
  }
```

- [ ] **Step 3: Pass field to submit**

In `src/app/app/games/new/page.tsx`, find the submit builder that creates the `CreateGameTemplateInput` and add:

```ts
trackEliminationOrder: state.trackEliminationOrder,
```

- [ ] **Step 4: Extend `CreateGameTemplateInput` + persist**

In `src/app/app/games/actions.ts`, add to `CreateGameTemplateInput`:

```ts
trackEliminationOrder: boolean
```

Persist in `prisma.gameTemplate.create`:

```ts
trackEliminationOrder: input.trackEliminationOrder,
```

- [ ] **Step 5: Add i18n keys**

In `messages/nl/app.json`, inside `app.games.wizard`:

```json
"trackEliminationOrderToggle": "Eliminatievolgorde bijhouden"
```

In `messages/en/app.json`, same key with value `"Track elimination order"`.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "games/new|games/actions"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/app/app/games/new/ src/app/app/games/actions.ts messages/nl/app.json messages/en/app.json
git commit -m "feat(wizard): trackEliminationOrder toggle on elimination templates"
```

---

## Task 9: Log form rewrite (adaptive per winType)

**Files:**
- Modify: `src/app/app/leagues/[id]/log/page.tsx`

This is the biggest single file in the plan. The existing ~410-line component becomes a dispatcher + branch components. Work inside one file but keep the branches focused.

- [ ] **Step 1: Replace the file with the new adaptive shell**

Full file contents (replaces existing):

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { logPlayedGame, editPlayedGame } from '../actions'
import type { WinType } from '@/app/app/games/new/wizard-types'
import type { ResolverInput } from '@/lib/game-logic/types'
import { parseTimeInput, formatTime } from '@/lib/game-logic/formatTime'

type Member = { id: string; player: { id: string; name: string; userId: string | null } }

type Template = {
  winType: WinType
  winCondition: 'high' | 'low' | null
  scoreFields: string[]
  roles: string[]
  missions: string[]
  minPlayers: number | null
  maxPlayers: number | null
  trackDifficulty: boolean
  trackTeamScores: boolean
  trackEliminationOrder: boolean
  timeUnit: 'seconds' | 'minutes' | 'mmss' | null
}

function defaultDatetime(): string {
  const ms = 5 * 60 * 1000
  const now = new Date(Math.round(Date.now() / ms) * ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export default function LogGamePage() {
  const t = useTranslations('app.playedGames')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const router = useRouter()
  const { id: leagueId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [members, setMembers] = useState<Member[]>([])
  const [template, setTemplate] = useState<Template | null>(null)
  const [step, setStep] = useState<'participants' | 'scores'>('participants')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [playedAt, setPlayedAt] = useState(defaultDatetime())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Type-specific state — only the relevant slice is used per winType
  const [scoresByPlayerByField, setScoresByPlayer] = useState<Record<string, string[]>>({})
  const [winnerId, setWinnerId] = useState<string>('')
  const [winnerScore, setWinnerScore] = useState<string>('')
  const [winningMission, setWinningMission] = useState<string>('')
  const [timeByPlayer, setTimeByPlayer] = useState<Record<string, string | { mm: string; ss: string }>>({})
  const [rankByPlayer, setRankByPlayer] = useState<Record<string, string>>({})
  const [eliminationOrderByPlayer, setEliminationOrderByPlayer] = useState<Record<string, string>>({})
  const [roleByPlayer, setRoleByPlayer] = useState<Record<string, string>>({})
  const [coopWon, setCoopWon] = useState<boolean | null>(null)
  const [difficulty, setDifficulty] = useState<string>('')
  const [teamCount, setTeamCount] = useState<number>(2)
  const [teams, setTeams] = useState<string[]>(['Team 1', 'Team 2'])
  const [teamByPlayer, setTeamByPlayer] = useState<Record<string, string>>({})
  const [winningTeam, setWinningTeam] = useState<string>('')
  const [perTeamScores, setPerTeamScores] = useState<Record<string, string>>({})

  // Load template + members
  useEffect(() => {
    fetch(`/api/app/leagues/${leagueId}/members`)
      .then(r => r.json())
      .then((data: { members: Member[]; template: Template }) => {
        setMembers(data.members)
        setTemplate(data.template)
        const initial: Record<string, string[]> = {}
        const fields = data.template.scoreFields.length > 0 ? data.template.scoreFields : ['']
        data.members.forEach(m => { initial[m.player.id] = Array(fields.length).fill('') })
        setScoresByPlayer(initial)
      })
      .catch(() => {})
  }, [leagueId])

  // Load existing session in edit mode
  useEffect(() => {
    if (!editId) return
    fetch(`/api/app/leagues/${leagueId}/sessions/${editId}`)
      .then(r => r.json())
      .then((data: {
        playedAt: string
        notes: string
        winningMission: string
        difficulty: string
        teams: string[]
        teamScores: { name: string; score: number }[] | null
        participantIds: string[]
        winnerId: string
        scores: {
          playerId: string; score: number; isWinner: boolean
          role: string | null; team: string | null; rank: number | null; eliminationOrder: number | null
        }[]
      } | null) => {
        if (!data) return
        setPlayedAt(data.playedAt)
        setNotes(data.notes)
        setWinningMission(data.winningMission)
        setDifficulty(data.difficulty)
        setSelectedIds(new Set(data.participantIds))
        setWinnerId(data.winnerId)
        const winnerEntry = data.scores.find(s => s.playerId === data.winnerId)
        if (winnerEntry) setWinnerScore(String(winnerEntry.score))

        // time
        const timeMap: Record<string, string | { mm: string; ss: string }> = {}
        // rank
        const rankMap: Record<string, string> = {}
        // elimination
        const elimMap: Record<string, string> = {}
        // role
        const roleMap: Record<string, string> = {}
        // team
        const teamMap: Record<string, string> = {}
        for (const s of data.scores) {
          timeMap[s.playerId] = String(s.score)
          if (s.rank !== null) rankMap[s.playerId] = String(s.rank)
          if (s.eliminationOrder !== null) elimMap[s.playerId] = String(s.eliminationOrder)
          if (s.role) roleMap[s.playerId] = s.role
          if (s.team) teamMap[s.playerId] = s.team
        }
        setTimeByPlayer(timeMap)
        setRankByPlayer(rankMap)
        setEliminationOrderByPlayer(elimMap)
        setRoleByPlayer(roleMap)
        setTeamByPlayer(teamMap)
        if (data.teams.length > 0) {
          setTeams(data.teams)
          setTeamCount(data.teams.length)
        }
        if (data.teamScores) {
          setPerTeamScores(Object.fromEntries(data.teamScores.map(ts => [ts.name, String(ts.score)])))
        }
        // cooperative: derive won/lost from any score entry
        if (data.scores.length > 0) setCoopWon(data.scores[0].isWinner)
        // winning team: find team of any isWinner score
        const winSe = data.scores.find(s => s.isWinner && s.team)
        if (winSe) setWinningTeam(winSe.team!)

        // score grid for points-all
        setScoresByPlayer(prev => {
          const merged: Record<string, string[]> = { ...prev }
          data.scores.forEach(s => {
            if (merged[s.playerId]) {
              merged[s.playerId] = merged[s.playerId].map((_, i) => (i === 0 ? String(s.score) : ''))
            } else {
              merged[s.playerId] = [String(s.score)]
            }
          })
          return merged
        })
      })
      .catch(() => {})
  }, [editId, leagueId])

  if (!template) {
    return <div className="max-w-lg mx-auto py-8 px-2"><p className="font-body text-sm">Loading…</p></div>
  }

  const winType = template.winType
  const selectedCount = selectedIds.size
  const participants = members.filter(m => selectedIds.has(m.player.id))

  const playerCountError = (() => {
    if (template.minPlayers !== null && selectedCount < template.minPlayers) return t('minPlayersNote', { min: template.minPlayers })
    if (template.maxPlayers !== null && selectedCount > template.maxPlayers) return t('maxPlayersNote', { max: template.maxPlayers })
    return null
  })()

  function toggleParticipant(playerId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  function buildResolverInput(): ResolverInput | { error: string } {
    const participantIds = participants.map(p => p.player.id)
    switch (winType) {
      case 'points-all': {
        const perPlayerScores: Record<string, number> = {}
        for (const pid of participantIds) {
          const arr = scoresByPlayerByField[pid] ?? []
          perPlayerScores[pid] = arr.reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
        }
        return { participantIds, perPlayerScores }
      }
      case 'points-winner':
        if (!winnerId) return { error: 'required' }
        return { participantIds, winnerId, winnerScore: parseInt(winnerScore, 10) || 0 }
      case 'time': {
        const perPlayerTimeSeconds: Record<string, number> = {}
        for (const pid of participantIds) {
          const raw = timeByPlayer[pid]
          if (raw === undefined) return { error: 'required' }
          const parsed = parseTimeInput(raw, template.timeUnit)
          if (parsed === null) return { error: 'required' }
          perPlayerTimeSeconds[pid] = parsed
        }
        return { participantIds, perPlayerTimeSeconds }
      }
      case 'ranking': {
        const perPlayerRank: Record<string, number> = {}
        for (const pid of participantIds) {
          const r = parseInt(rankByPlayer[pid] ?? '', 10)
          if (!Number.isFinite(r)) return { error: 'required' }
          perPlayerRank[pid] = r
        }
        return { participantIds, perPlayerRank }
      }
      case 'elimination': {
        if (!template.trackEliminationOrder) {
          if (!winnerId) return { error: 'required' }
          return { participantIds, winnerId }
        }
        const perPlayerEliminationOrder: Record<string, number | null> = {}
        for (const pid of participantIds) {
          const raw = eliminationOrderByPlayer[pid]
          if (raw === undefined || raw.trim() === '') perPlayerEliminationOrder[pid] = null
          else {
            const n = parseInt(raw, 10)
            if (!Number.isFinite(n)) return { error: 'required' }
            perPlayerEliminationOrder[pid] = n
          }
        }
        return { participantIds, perPlayerEliminationOrder }
      }
      case 'winner': {
        if (!winnerId) return { error: 'required' }
        const perPlayerRole: Record<string, string | null> = {}
        if (template.roles.length > 0) {
          for (const pid of participantIds) perPlayerRole[pid] = roleByPlayer[pid] || null
        }
        return { participantIds, winnerId, perPlayerRole }
      }
      case 'cooperative': {
        if (coopWon === null) return { error: 'required' }
        return { participantIds, cooperativeWon: coopWon, difficulty }
      }
      case 'team': {
        if (!winningTeam) return { error: 'required' }
        for (const pid of participantIds) if (!teamByPlayer[pid]) return { error: 'required' }
        const perTeamScoresNum: Record<string, number> = {}
        if (template.trackTeamScores) {
          for (const name of teams) perTeamScoresNum[name] = parseInt(perTeamScores[name] ?? '', 10) || 0
        }
        return {
          participantIds,
          teams,
          teamAssignments: Object.fromEntries(participantIds.map(p => [p, teamByPlayer[p]])),
          winningTeam,
          perTeamScores: template.trackTeamScores ? perTeamScoresNum : undefined,
        }
      }
      case 'secret-mission': {
        if (!winnerId) return { error: 'required' }
        if (!winningMission) return { error: 'required' }
        return { participantIds, winnerId, winningMission }
      }
    }
  }

  async function handleSubmit() {
    const resolverOrErr = buildResolverInput()
    if ('error' in resolverOrErr) { toast.error(tErrors(resolverOrErr.error as never)); return }

    setLoading(true)
    const result = editId
      ? await editPlayedGame(editId, leagueId, { playedAt: new Date(playedAt), notes, resolverInput: resolverOrErr })
      : await logPlayedGame(leagueId, { playedAt: new Date(playedAt), notes, resolverInput: resolverOrErr })
    setLoading(false)

    if (!result.success) { toast.error(tErrors(result.error as never)); return }
    toast.success(editId ? tToasts('sessionUpdated') : tToasts('gameSaved'))
    router.push(`/app/leagues/${leagueId}`)
  }

  if (step === 'participants') {
    return (
      <ParticipantStep
        t={t}
        members={members}
        selectedIds={selectedIds}
        toggleParticipant={toggleParticipant}
        selectedCount={selectedCount}
        playerCountError={playerCountError}
        minPlayers={template.minPlayers}
        maxPlayers={template.maxPlayers}
        editId={editId}
        onContinue={() => setStep('scores')}
      />
    )
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setStep('participants')}
          className="font-headline font-semibold text-sm"
          style={{ color: '#f5a623' }}
        >
          {t('back')}
        </button>
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>
          {editId ? t('edit') : t('log')}
        </h1>
      </div>

      <div className="space-y-4 p-6 rounded-2xl mb-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <DateTimeField value={playedAt} onChange={setPlayedAt} label={t('playedAt')} />

        {winType === 'points-all' && (
          <ScoreGrid
            label={t('scores')}
            participants={participants}
            scoreFields={template.scoreFields}
            scores={scoresByPlayerByField}
            onChange={setScoresByPlayer}
            scorePlaceholder={t('scorePlaceholder')}
          />
        )}

        {(winType === 'points-winner' || winType === 'winner' || winType === 'secret-mission' || (winType === 'elimination' && !template.trackEliminationOrder)) && (
          <WinnerRadio label={t('winner')} participants={participants} winnerId={winnerId} onChange={setWinnerId} />
        )}

        {winType === 'points-winner' && winnerId && (
          <NumberField label={t('winnerScore')} value={winnerScore} onChange={setWinnerScore} placeholder={t('scorePlaceholder')} />
        )}

        {winType === 'time' && (
          <TimeInputs
            label={t('scores')}
            participants={participants}
            unit={template.timeUnit}
            values={timeByPlayer}
            onChange={setTimeByPlayer}
          />
        )}

        {winType === 'ranking' && (
          <RankingInputs label={t('rankings')} participants={participants} values={rankByPlayer} onChange={setRankByPlayer} />
        )}

        {winType === 'elimination' && template.trackEliminationOrder && (
          <EliminationOrderInputs
            label={t('eliminationOrder')}
            participants={participants}
            values={eliminationOrderByPlayer}
            onChange={setEliminationOrderByPlayer}
          />
        )}

        {winType === 'winner' && template.roles.length > 0 && participants.length > 0 && (
          <RoleDropdowns
            label={t('roles')}
            participants={participants}
            roles={template.roles}
            values={roleByPlayer}
            onChange={setRoleByPlayer}
          />
        )}

        {winType === 'cooperative' && (
          <CooperativeResult
            label={t('coopResult')}
            won={coopWon}
            onChange={setCoopWon}
            wonLabel={t('coopWon')}
            lostLabel={t('coopLost')}
          />
        )}
        {winType === 'cooperative' && template.trackDifficulty && (
          <TextField label={t('difficulty')} value={difficulty} onChange={setDifficulty} placeholder={t('difficultyPlaceholder')} />
        )}

        {winType === 'team' && (
          <TeamSetup
            participants={participants}
            teamCount={teamCount}
            teams={teams}
            teamByPlayer={teamByPlayer}
            winningTeam={winningTeam}
            perTeamScores={perTeamScores}
            trackTeamScores={template.trackTeamScores}
            onTeamCountChange={n => {
              setTeamCount(n)
              setTeams(prev => {
                const next = [...prev]
                while (next.length < n) next.push(`Team ${next.length + 1}`)
                next.length = n
                return next
              })
            }}
            onTeamsChange={setTeams}
            onTeamByPlayerChange={setTeamByPlayer}
            onWinningTeamChange={setWinningTeam}
            onPerTeamScoresChange={setPerTeamScores}
            t={t}
          />
        )}

        {winType === 'secret-mission' && template.missions.length > 0 && (
          <MissionDropdown
            label={t('winningMission')}
            missions={template.missions}
            value={winningMission}
            onChange={setWinningMission}
          />
        )}

        <TextArea label={t('notes')} value={notes} onChange={setNotes} />

        {!editId && (
          <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
            {t('cost')}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
        style={{ background: '#f5a623', color: '#1c1408' }}
      >
        {loading ? t('saving') : editId ? t('saveChanges') : t('submit')}
      </button>
    </div>
  )
}

/* ---------- Sub-components below ---------- */

function ParticipantStep({
  t, members, selectedIds, toggleParticipant, selectedCount,
  playerCountError, minPlayers, maxPlayers, editId, onContinue,
}: {
  t: ReturnType<typeof useTranslations>
  members: Member[]
  selectedIds: Set<string>
  toggleParticipant: (id: string) => void
  selectedCount: number
  playerCountError: string | null
  minPlayers: number | null
  maxPlayers: number | null
  editId: string | null
  onContinue: () => void
}) {
  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      <h1 className="font-headline font-black text-2xl mb-6" style={{ color: '#1c1810' }}>
        {editId ? t('edit') : t('log')}
      </h1>
      <div className="space-y-4 p-6 rounded-2xl mb-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="font-headline font-semibold text-xs" style={{ color: '#4a3f2f' }}>
              {t('selectParticipants')}
            </label>
            <span className="font-headline font-bold text-xs" style={{ color: '#9a8878' }}>
              {t('playersSelected', { count: selectedCount })}
              {(minPlayers !== null || maxPlayers !== null) && (
                <span className="ml-2" style={{ color: '#c4b79a' }}>
                  ({t('playerHint', { min: minPlayers ?? '?', max: maxPlayers ?? '?' })})
                </span>
              )}
            </span>
          </div>
          <ul className="space-y-2">
            {members.map(m => {
              const selected = selectedIds.has(m.player.id)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggleParticipant(m.player.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                    style={{
                      borderColor: selected ? '#f5a623' : '#e8e1d8',
                      background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                      color: '#1c1810',
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center"
                      style={{ borderColor: selected ? '#f5a623' : '#c4b79a', background: selected ? '#f5a623' : 'transparent' }}
                    >
                      {selected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {m.player.name}
                  </button>
                </li>
              )
            })}
          </ul>
          {playerCountError && (
            <p className="mt-3 text-xs font-body" style={{ color: '#c47f00' }}>{playerCountError}</p>
          )}
        </div>
      </div>
      <button
        onClick={onContinue}
        disabled={selectedCount === 0 || !!playerCountError}
        className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-40"
        style={{ background: '#f5a623', color: '#1c1408' }}
      >
        {t('continue')}
      </button>
    </div>
  )
}

function DateTimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{label}</label>
      <input
        type="datetime-local"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm"
        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
      />
    </div>
  )
}

function TextArea({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
      />
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm"
        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
      />
    </div>
  )
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border font-headline font-bold text-sm text-right"
        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
      />
    </div>
  )
}

function ScoreGrid({ label, participants, scoreFields, scores, onChange, scorePlaceholder }: {
  label: string
  participants: Member[]
  scoreFields: string[]
  scores: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  scorePlaceholder: string
}) {
  const fields = scoreFields.length > 0 ? scoreFields : ['']
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-3">
        {participants.map(m => (
          <li key={m.id} className="rounded-xl border p-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
            <span className="block font-headline font-semibold text-sm mb-2" style={{ color: '#1c1810' }}>{m.player.name}</span>
            {fields.length > 1 ? (
              <div className="space-y-1.5">
                {fields.map((field, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 font-body text-xs" style={{ color: '#4a3f2f' }}>{field}</span>
                    <input
                      type="number"
                      value={scores[m.player.id]?.[i] ?? ''}
                      onChange={e => {
                        const arr = [...(scores[m.player.id] ?? [])]
                        arr[i] = e.target.value
                        onChange({ ...scores, [m.player.id]: arr })
                      }}
                      placeholder="0"
                      className="w-24 px-3 py-1.5 rounded-xl border font-headline font-bold text-sm text-right"
                      style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <input
                type="number"
                value={scores[m.player.id]?.[0] ?? ''}
                onChange={e => onChange({ ...scores, [m.player.id]: [e.target.value] })}
                placeholder={scorePlaceholder}
                className="w-full px-3 py-2 rounded-xl border font-headline font-bold text-sm text-right"
                style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function WinnerRadio({ label, participants, winnerId, onChange }: {
  label: string; participants: Member[]; winnerId: string; onChange: (id: string) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {participants.map(m => {
          const selected = winnerId === m.player.id
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onChange(m.player.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                style={{
                  borderColor: selected ? '#f5a623' : '#e8e1d8',
                  background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                  color: '#1c1810',
                }}
              >
                <span className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: selected ? '#f5a623' : '#c4b79a' }}>
                  {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623' }} />}
                </span>
                {m.player.name}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TimeInputs({ label, participants, unit, values, onChange }: {
  label: string; participants: Member[]; unit: 'seconds' | 'minutes' | 'mmss' | null
  values: Record<string, string | { mm: string; ss: string }>
  onChange: (next: Record<string, string | { mm: string; ss: string }>) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-3">
        {participants.map(m => {
          const v = values[m.player.id]
          return (
            <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
              <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
              {unit === 'mmss' ? (
                <>
                  <input type="number" placeholder="MM"
                    value={(typeof v === 'object' ? v.mm : '') as string}
                    onChange={e => onChange({ ...values, [m.player.id]: { mm: e.target.value, ss: typeof v === 'object' ? v.ss : '' } })}
                    className="w-14 px-2 py-1.5 rounded-xl border text-right" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }} />
                  <span style={{ color: '#9a8878' }}>:</span>
                  <input type="number" placeholder="SS"
                    value={(typeof v === 'object' ? v.ss : '') as string}
                    onChange={e => onChange({ ...values, [m.player.id]: { mm: typeof v === 'object' ? v.mm : '', ss: e.target.value } })}
                    className="w-14 px-2 py-1.5 rounded-xl border text-right" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }} />
                </>
              ) : (
                <input
                  type="number"
                  step={unit === 'minutes' ? '0.1' : '1'}
                  placeholder={unit === 'minutes' ? 'min' : 'sec'}
                  value={typeof v === 'string' ? v : ''}
                  onChange={e => onChange({ ...values, [m.player.id]: e.target.value })}
                  className="w-24 px-3 py-1.5 rounded-xl border text-right" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RankingInputs({ label, participants, values, onChange }: {
  label: string; participants: Member[]; values: Record<string, string>; onChange: (next: Record<string, string>) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {participants.map(m => (
          <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
            <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
            <input
              type="number" min={1} max={participants.length} placeholder="#"
              value={values[m.player.id] ?? ''}
              onChange={e => onChange({ ...values, [m.player.id]: e.target.value })}
              className="w-16 px-3 py-1.5 rounded-xl border text-right font-headline font-bold text-sm"
              style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function EliminationOrderInputs({ label, participants, values, onChange }: {
  label: string; participants: Member[]; values: Record<string, string>; onChange: (next: Record<string, string>) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {participants.map(m => (
          <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
            <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
            <input
              type="number" min={1} placeholder="—"
              value={values[m.player.id] ?? ''}
              onChange={e => onChange({ ...values, [m.player.id]: e.target.value })}
              className="w-16 px-3 py-1.5 rounded-xl border text-right font-headline font-bold text-sm"
              style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoleDropdowns({ label, participants, roles, values, onChange }: {
  label: string; participants: Member[]; roles: string[]; values: Record<string, string>; onChange: (next: Record<string, string>) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {participants.map(m => (
          <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
            <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
            <select
              value={values[m.player.id] ?? ''}
              onChange={e => onChange({ ...values, [m.player.id]: e.target.value })}
              className="px-3 py-1.5 rounded-xl border font-body text-sm" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
            >
              <option value="">—</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CooperativeResult({ label, won, onChange, wonLabel, lostLabel }: {
  label: string; won: boolean | null; onChange: (v: boolean) => void; wonLabel: string; lostLabel: string
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <div className="flex gap-2">
        {[{ v: true, l: wonLabel }, { v: false, l: lostLabel }].map(opt => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => onChange(opt.v)}
            className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{
              background: won === opt.v ? '#f5a623' : '#f0ebe3',
              color: won === opt.v ? '#1c1408' : '#4a3f2f',
            }}
          >
            {opt.l}
          </button>
        ))}
      </div>
    </div>
  )
}

function MissionDropdown({ label, missions, value, onChange }: {
  label: string; missions: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {missions.map(m => {
          const selected = value === m
          return (
            <li key={m}>
              <button
                type="button"
                onClick={() => onChange(m)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left"
                style={{
                  borderColor: selected ? '#f5a623' : '#e8e1d8',
                  background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                  color: '#1c1810',
                }}
              >
                <span className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: selected ? '#f5a623' : '#c4b79a' }}>
                  {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623' }} />}
                </span>
                {m}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TeamSetup(props: {
  participants: Member[]
  teamCount: number
  teams: string[]
  teamByPlayer: Record<string, string>
  winningTeam: string
  perTeamScores: Record<string, string>
  trackTeamScores: boolean
  onTeamCountChange: (n: number) => void
  onTeamsChange: (teams: string[]) => void
  onTeamByPlayerChange: (map: Record<string, string>) => void
  onWinningTeamChange: (team: string) => void
  onPerTeamScoresChange: (map: Record<string, string>) => void
  t: ReturnType<typeof useTranslations>
}) {
  const { participants, teamCount, teams, teamByPlayer, winningTeam, perTeamScores, trackTeamScores, t } = props
  const maxTeams = Math.max(2, Math.floor(participants.length / 2))
  return (
    <div className="space-y-4">
      <div>
        <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('teamCount')}</label>
        <input
          type="number" min={2} max={maxTeams} value={teamCount}
          onChange={e => {
            const n = Math.max(2, Math.min(maxTeams, parseInt(e.target.value, 10) || 2))
            props.onTeamCountChange(n)
          }}
          className="w-24 px-3 py-1.5 rounded-xl border text-right font-headline font-bold text-sm"
          style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
        />
      </div>
      <div>
        <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('teamNames')}</label>
        <div className="space-y-2">
          {teams.map((tn, i) => (
            <input
              key={i}
              value={tn}
              onChange={e => {
                const next = [...teams]
                next[i] = e.target.value
                props.onTeamsChange(next)
              }}
              className="w-full px-3 py-2 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('teamAssignment')}</label>
        <ul className="space-y-2">
          {participants.map(m => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
              <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
              <select
                value={teamByPlayer[m.player.id] ?? ''}
                onChange={e => props.onTeamByPlayerChange({ ...teamByPlayer, [m.player.id]: e.target.value })}
                className="px-3 py-1.5 rounded-xl border font-body text-sm" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
              >
                <option value="">—</option>
                {teams.map(tn => <option key={tn} value={tn}>{tn}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winningTeam')}</label>
        <div className="flex flex-wrap gap-2">
          {teams.map(tn => {
            const selected = winningTeam === tn
            return (
              <button
                key={tn} type="button"
                onClick={() => props.onWinningTeamChange(tn)}
                className="px-4 py-2 rounded-xl border font-headline font-bold text-sm"
                style={{
                  borderColor: selected ? '#f5a623' : '#e8e1d8',
                  background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                  color: '#1c1810',
                }}
              >{tn}</button>
            )
          })}
        </div>
      </div>
      {trackTeamScores && (
        <div>
          <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('teamScores')}</label>
          <ul className="space-y-2">
            {teams.map(tn => (
              <li key={tn} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
                <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{tn}</span>
                <input
                  type="number"
                  value={perTeamScores[tn] ?? ''}
                  onChange={e => props.onPerTeamScoresChange({ ...perTeamScores, [tn]: e.target.value })}
                  className="w-24 px-3 py-1.5 rounded-xl border text-right font-headline font-bold text-sm"
                  style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add new i18n keys**

In `messages/nl/app.json` `app.playedGames`:

```json
"rankings": "Positie per speler",
"eliminationOrder": "Eliminatievolgorde (leeg = laatste overlevende)",
"roles": "Rol per speler",
"coopResult": "Resultaat",
"coopWon": "Gewonnen",
"coopLost": "Verloren",
"difficulty": "Moeilijkheidsgraad",
"difficultyPlaceholder": "bijv. medium, hard, nightmare",
"teamCount": "Aantal teams",
"teamNames": "Teamnamen",
"teamAssignment": "Speler → team",
"winningTeam": "Winnend team",
"teamScores": "Score per team"
```

Same keys in `messages/en/app.json` with English values:

```json
"rankings": "Player ranks",
"eliminationOrder": "Elimination order (empty = last standing)",
"roles": "Role per player",
"coopResult": "Result",
"coopWon": "Won",
"coopLost": "Lost",
"difficulty": "Difficulty",
"difficultyPlaceholder": "e.g. medium, hard, nightmare",
"teamCount": "Number of teams",
"teamNames": "Team names",
"teamAssignment": "Player → team",
"winningTeam": "Winning team",
"teamScores": "Score per team"
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test" | head -30
```

Expected: no production-code errors.

- [ ] **Step 4: Dev smoke**

```bash
npm run dev
```

Create one template per winType via the wizard (9 templates), then visit each log page and verify the form shows the correct inputs. Log one session per type; verify it saves without error.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/leagues/[id]/log/page.tsx messages/nl/app.json messages/en/app.json
git commit -m "feat(log): adaptive log form per winType (time/ranking/elim/winner+roles/coop/team)"
```

---

## Task 10: Display updates — league page + dashboard

**Files:**
- Modify: `src/app/app/leagues/[id]/page.tsx`
- Modify: `src/app/app/dashboard/page.tsx`

- [ ] **Step 1: League played-games list — winType-aware rendering**

In `src/app/app/leagues/[id]/page.tsx`:

1. Extend the `playedGames` include to pull the new fields. Replace the existing `playedGames` select block:

```ts
playedGames: {
  where: { status: 'approved' },
  select: {
    id: true,
    playedAt: true,
    notes: true,
    shareToken: true,
    difficulty: true,
    teams: true,
    teamScores: true,
    winningMission: true,
    scores: {
      select: {
        id: true, playerId: true, score: true,
        isWinner: true, role: true, team: true, rank: true, eliminationOrder: true,
        player: { select: { name: true } },
      },
      orderBy: { score: 'desc' },
    },
  },
  orderBy: { playedAt: 'desc' },
  take: 20,
},
```

Also extend the `gameTemplate` include to surface `winType`, `winCondition`, `timeUnit`:

```ts
gameTemplate: { select: { name: true, scoringNotes: true, winType: true, winCondition: true, timeUnit: true } },
```

2. Update `membersWithStats` to use `isWinner` instead of `scores[0]`:

```ts
const membersWithStats = league.members.map(m => {
  const participated = league.playedGames.filter(pg =>
    pg.scores.some(s => s.playerId === m.player.id)
  )
  const wins = participated.filter(pg =>
    pg.scores.some(s => s.playerId === m.player.id && s.isWinner)
  ).length
  const gamesPlayed = participated.length
  const winRatio = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : null
  return { ...m, wins, gamesPlayed, winRatio }
})
```

3. Rewrite the played-games list rendering. Replace the `<ul className="space-y-3">...</ul>` block inside `{league.playedGames.length === 0 ? ... : (...)}` with a type-dispatching renderer. At top of file, add:

```ts
import { formatTime } from '@/lib/game-logic/formatTime'
```

Replace the `<ul>` block:

```tsx
<ul className="space-y-3">
  {league.playedGames.map(pg => {
    const winners = pg.scores.filter(s => s.isWinner)
    return (
      <li key={pg.id} className="p-4 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-headline font-semibold text-xs flex-1" style={{ color: '#9a8878' }}>
            {new Date(pg.playedAt).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' })}
            {(new Date(pg.playedAt).getHours() !== 0 || new Date(pg.playedAt).getMinutes() !== 0) &&
              ` ${String(new Date(pg.playedAt).getHours()).padStart(2, '0')}:${String(new Date(pg.playedAt).getMinutes()).padStart(2, '0')}`}
          </span>
          {pg.shareToken && <ShareButton token={pg.shareToken} />}
          <SessionActions playedGameId={pg.id} leagueId={id} />
        </div>

        {/* Type-specific body */}
        {league.gameTemplate.winType === 'cooperative' ? (
          <p className="font-body text-sm" style={{ color: winners.length > 0 ? '#c27f0a' : '#9a8878' }}>
            {winners.length > 0 ? 'Gewonnen' : 'Verloren'}
            {pg.difficulty ? ` · ${pg.difficulty}` : ''}
          </p>
        ) : league.gameTemplate.winType === 'team' ? (
          <div>
            {winners.length > 0 && (
              <p className="font-headline font-semibold text-sm mb-1" style={{ color: '#1c1810' }}>
                Winnaar: {winners[0].team ?? '—'}
              </p>
            )}
            <ul className="space-y-0.5">
              {pg.teams.map(tn => {
                const playersInTeam = pg.scores.filter(s => s.team === tn)
                const teamScore = (pg.teamScores as { name: string; score: number }[] | null)?.find(ts => ts.name === tn)
                return (
                  <li key={tn} className="flex justify-between text-xs font-body">
                    <span style={{ color: winners[0]?.team === tn ? '#c27f0a' : '#4a3f2f' }}>
                      {tn}: {playersInTeam.map(p => p.player.name).join(', ')}
                    </span>
                    {teamScore && <span style={{ color: '#9a8878' }}>{teamScore.score}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : league.gameTemplate.winType === 'time' ? (
          <ul className="space-y-0.5">
            {pg.scores.slice().sort((a, b) => (
              (league.gameTemplate.winCondition === 'high' ? b.score - a.score : a.score - b.score)
            )).map((s, i) => (
              <li key={s.id} className="flex justify-between text-xs font-body">
                <span style={{ color: s.isWinner ? '#f5a623' : '#4a3f2f' }}>
                  {i === 0 ? '#1 ' : `#${i + 1} `}{s.player.name}
                </span>
                <span style={{ color: '#9a8878' }}>{formatTime(s.score, league.gameTemplate.timeUnit as never)}</span>
              </li>
            ))}
          </ul>
        ) : league.gameTemplate.winType === 'ranking' ? (
          <ul className="space-y-0.5">
            {pg.scores.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map(s => (
              <li key={s.id} className="flex justify-between text-xs font-body">
                <span style={{ color: s.isWinner ? '#f5a623' : '#4a3f2f' }}>#{s.rank} {s.player.name}</span>
              </li>
            ))}
          </ul>
        ) : league.gameTemplate.winType === 'elimination' && pg.scores.some(s => s.eliminationOrder !== null) ? (
          <ul className="space-y-0.5">
            {pg.scores.slice().sort((a, b) => ((b.eliminationOrder ?? Infinity) - (a.eliminationOrder ?? Infinity))).map(s => (
              <li key={s.id} className="flex justify-between text-xs font-body">
                <span style={{ color: s.isWinner ? '#f5a623' : '#4a3f2f' }}>
                  {s.isWinner ? '🏆 ' : ''}{s.player.name}
                </span>
                {s.eliminationOrder !== null && <span style={{ color: '#9a8878' }}>uitgeschakeld #{s.eliminationOrder}</span>}
              </li>
            ))}
          </ul>
        ) : league.gameTemplate.winType === 'winner' || league.gameTemplate.winType === 'secret-mission' ? (
          <div>
            {winners[0] && (
              <p className="font-headline font-semibold text-sm mb-1" style={{ color: '#c27f0a' }}>
                Winnaar: {winners[0].player.name}
                {pg.winningMission ? ` via ${pg.winningMission}` : ''}
              </p>
            )}
            {pg.scores.some(s => s.role) && (
              <p className="text-xs font-body" style={{ color: '#9a8878' }}>
                {pg.scores.map(s => `${s.player.name}${s.role ? ` (${s.role})` : ''}`).join(' · ')}
              </p>
            )}
          </div>
        ) : (
          // points-all / points-winner: unchanged score list
          <ul className="space-y-0.5">
            {pg.scores.map(s => (
              <li key={s.id} className="flex justify-between text-xs font-body">
                <span style={{ color: s.isWinner ? '#f5a623' : '#4a3f2f' }}>{s.player.name}</span>
                <span style={{ color: '#9a8878' }}>{s.score}</span>
              </li>
            ))}
          </ul>
        )}

        {pg.notes && <p className="text-xs font-body mt-2 italic" style={{ color: '#9a8878' }}>{pg.notes}</p>}
      </li>
    )
  })}
</ul>
```

- [ ] **Step 2: Dashboard `loadPlayedGames` — use `isWinner`**

In `src/app/app/dashboard/page.tsx`, find the `prisma.playedGame.findMany` call inside `loadPlayedGames`. Replace its `scores` block:

```ts
scores: {
  include: { player: { select: { id: true, name: true } } },
  orderBy: { score: 'desc' },
},
```

with (Prisma requires `select` OR `include`, not both, when picking `isWinner`):

```ts
scores: {
  select: {
    playerId: true,
    score: true,
    isWinner: true,
    player: { select: { id: true, name: true } },
  },
  orderBy: { score: 'desc' },
},
```

Update the `userWon` calculation inside `.map(pg => { ... })`:

```ts
const userInGame = pg.scores.some(s => userPlayerIds.has(s.player.id))
const userWon = pg.scores.some(s => userPlayerIds.has(s.player.id) && s.isWinner)
return {
  id: pg.id,
  gameName: pg.league.gameTemplate.name,
  leagueName: pg.league.name,
  playedAt: pg.playedAt.toISOString(),
  playerNames: pg.scores.map(s => s.player.name),
  userWon: userInGame ? userWon : null,
}
```

- [ ] **Step 3: Dashboard `loadDashboardStats` — use `isWinner` for ranking + topGames**

In the same file, inside `loadDashboardStats`, update the Prisma select on `scores`:

```ts
scores: {
  select: {
    playerId: true,
    score: true,
    isWinner: true,
    player: { select: { id: true, name: true, avatarSeed: true, userId: true } },
  },
  orderBy: { score: 'desc' },
},
```

Replace the Ranking aggregation block. Find:

```ts
const winner = pg.scores[0]
if (winner) playerMap[winner.player.id].wins++
```

Replace with:

```ts
for (const s of pg.scores) {
  if (s.isWinner && playerMap[s.player.id]) playerMap[s.player.id].wins++
}
```

Replace the Top games aggregation block. Find:

```ts
const winner = pg.scores[0]
for (const s of pg.scores) {
  if (userPlayerIds.has(s.player.id)) {
    gameMap[name].userGames++
    if (winner && s.player.id === winner.player.id) gameMap[name].userWins++
  }
}
```

Replace with:

```ts
for (const s of pg.scores) {
  if (userPlayerIds.has(s.player.id)) {
    gameMap[name].userGames++
    if (s.isWinner) gameMap[name].userWins++
  }
}
```

(Handles shared wins correctly — a cooperative game where everyone `isWinner` counts each player's participation AND win, which is the intended behaviour.)

- [ ] **Step 4: Dev smoke**

```bash
npm run dev
```

Visit `/app/dashboard` → rows render identically to before (compact table unchanged), ranking panel now counts `isWinner` correctly (for cooperative games, every participant adds a win; for time/ranking games, the actual winner adds a win instead of the highest score). Visit `/app/leagues/<id>` with sessions from various winTypes → verify per-type rendering.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/leagues/[id]/page.tsx src/app/app/dashboard/page.tsx
git commit -m "feat(display): winType-aware rendering; dashboard stats use isWinner"
```

---

## Task 11: Full type check + test suite + migration sanity

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "^\S.*\.tsx?\(.*\): error" | cut -d'(' -f1 | sort -u
```

Expected: only pre-existing test files (`src/test/*`, `src/lib/credits.test.ts`). No production-code files in the list.

- [ ] **Step 2: Full vitest run**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: new `src/lib/game-logic/` tests pass (~25 assertions). Pre-existing failure count unchanged (14).

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -25
```

Expected: build succeeds.

- [ ] **Step 4: Manual smoke — full user flow**

For each of the 9 winTypes:
- Create a template via wizard (where applicable: toggle `trackDifficulty`, `trackTeamScores`, `trackEliminationOrder`, set `winCondition='low'` for at least one points-all and one time template)
- Create a league using that template
- Log a session
- Verify the log form showed the right inputs
- Verify the league page renders the session correctly
- Edit the session — verify inputs are pre-filled; save and verify display unchanged
- Delete the session

Check:
- Cooperative session with `trackDifficulty=true` displays "Gewonnen · hard"
- Team session with `trackTeamScores=true` displays per-team scores
- Time + mmss displays `M:SS` format
- Ranking displays `#1 · #2 · #3` order
- `winCondition='low'` points-all marks lowest sum as winner (amber name)

Stop here if anything looks wrong — the plan's work is complete, but the phase isn't done until display + form + stats are verified.

---

## Task 12: INDEX.md + push

**Files:**
- Modify: `docs/superpowers/plans/INDEX.md`

- [ ] **Step 1: Mark phase 9 done**

In `docs/superpowers/plans/INDEX.md`, change:

```markdown
| **9** | [log-form-win-types.md](2026-04-23-log-form-win-types.md) | ready to execute | Adaptive log form per winType + isWinner flag + schema + display + stats |
```

to:

```markdown
| **9** | [log-form-win-types.md](2026-04-23-log-form-win-types.md) | done | Adaptive log form per winType + isWinner flag + schema + display + stats |
```

- [ ] **Step 2: Commit + push**

```bash
git add docs/superpowers/plans/INDEX.md
git commit -m "docs: mark phase 9 (log-form win types) done"
git push origin main
```

Coolify auto-deploys on push.
