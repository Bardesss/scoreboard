# Log Form — Win Type Audit & Fix — Design Spec

**Date:** 2026-04-23
**Status:** Approved for implementation planning
**Supersedes:** The `points-winner` hotfix (commit `1ba323d`). That fix is preserved and becomes one case within this broader solution.

---

## Goal

Make the session-log form collect the right data for every `WinType`, and make all display + stats code treat "who won" as an explicit property of each `ScoreEntry` instead of a sort-order convention over raw `score` values. Covers every gap uncovered in the win-type audit: cooperative games wrongly demanding a winner, team games collapsed to a single winner, winner-with-roles losing role information, time games missing unit-aware input, ranking games storing inverted values, `winCondition='low'` ignored everywhere, and no tracking for cooperative difficulty, team scores, or elimination order.

---

## Scope

### In scope
- Schema additions to `ScoreEntry`, `PlayedGame`, `GameTemplate` (all nullable / defaulted — backwards-compatible)
- `isWinner: Boolean` on `ScoreEntry` — explicit winner flag, replaces "scores[0] is the winner" convention
- Server-side `resolveScoreEntries(template, input)` helper — single place where template logic decides who wins and what extra fields to set
- Adaptive log form that branches per `winType` with the correct inputs (see §4)
- Respecting `winCondition` (`high` / `low`) for `points-all` + `time`
- `time` + `timeUnit`-aware input (seconds / minutes / MM:SS) and display
- `ranking` input (positie per speler) with validation (unique ranks in `1..N`)
- `elimination` with optional ordered elimination (gated by new `trackEliminationOrder` template flag)
- `winner` + optional per-player role assignment (when `template.rolesEnabled`)
- `cooperative` — team-won toggle + optional free-text difficulty label
- `team` — dynamic team setup (count + names + per-player assignment + winning team + optional per-team scores)
- Data migration: set `isWinner=true` on the top-`score` entry per existing `PlayedGame`
- Display changes on all pages that show "winner" or per-player scores (league page, dashboard games table, share page, pending-approval) — winType-aware rendering
- Stats aggregator rewrites to use `isWinner` instead of `scores[0]`
- Wizard step-3 addition: `trackEliminationOrder` toggle on `elimination` templates
- Unit tests for `resolveScoreEntries` per winType + updated aggregator tests

### Out of scope
- Retroactive data repair for old `time` / `ranking` / `winCondition='low'` sessions — winner flag is backfilled from `score DESC` which is wrong for those templates. Documented as a known limitation.
- Per-player contribution tracking inside cooperative games (only team-level won/lost)
- Tournament / bracket tracking across sessions
- Exports in winType-specific formats
- UI for renaming teams after save (locked)
- Head-to-head on cooperative leagues (aggregator returns `null` — existing hide rule handles)
- Draggable reorder UIs for ranking or elimination order (numeric inputs only)
- Custom role definitions per session (must come from `template.roles[]` — no ad-hoc roles)

---

## Architecture

### Winner resolution — explicit flag

Today "winner" is derived: every display/stats site picks `ScoreEntry` with the highest `score`. That convention breaks for:
- `time` + fastest-wins
- `points-all` with `winCondition='low'`
- `ranking` (rank 1 has lowest number semantically)
- `cooperative` (everyone wins/loses together)
- `team` (all players on winning team are "winners")
- `elimination` (last-standing, which may not have the highest raw score)

Solution: add `ScoreEntry.isWinner: Boolean`. The log action is the sole writer, applying the correct template logic. All downstream code queries the boolean — no sort-order tricks.

### Where the logic lives

One pure server function, tested per winType:

```ts
// src/lib/game-logic/resolveScoreEntries.ts
export function resolveScoreEntries(
  template: {
    winType: WinType
    winCondition: 'high' | 'low' | null
    scoreFields: string[]
    roles: string[]
    missions: string[]
    trackDifficulty: boolean
    trackTeamScores: boolean
    trackEliminationOrder: boolean
    timeUnit: 'seconds' | 'minutes' | 'mmss' | null
  },
  input: LogSessionInput,
): {
  scoreEntries: {
    playerId: string
    score: number
    isWinner: boolean
    role: string | null
    team: string | null
    rank: number | null
    eliminationOrder: number | null
  }[]
  playedGameExtras: {
    winningMission: string | null
    difficulty: string | null
    teams: string[]
    teamScores: { name: string; score: number }[] | null
  }
}
```

`logPlayedGame` and `editPlayedGame` both call this and persist the result. Validation also lives here — returns `{ error: 'missingWinner' | 'invalidRanks' | ... }` instead of `{ scoreEntries, ... }` on bad input.

---

## Schema changes

### `ScoreEntry` — add columns

```prisma
model ScoreEntry {
  // existing: id, playedGameId, playerId, score
  isWinner          Boolean @default(false)
  role              String?
  team              String?
  rank              Int?
  eliminationOrder  Int?
}
```

### `PlayedGame` — add columns

```prisma
model PlayedGame {
  // existing: ..., winningMission, notes, shareToken, status, ...
  difficulty   String?
  teams        String[] @default([])
  teamScores   Json?     // [{ name: string, score: number }, ...]
}
```

### `GameTemplate` — add column

```prisma
model GameTemplate {
  // existing: ...
  trackEliminationOrder Boolean @default(false)
}
```

### Migrations

Two migrations in one Prisma migration step:

1. **Schema migration** — adds all new columns (nullable / defaulted). Safe to run on live data.
2. **Data backfill** — run immediately after the schema migration:

```sql
UPDATE "ScoreEntry" se
SET "isWinner" = true
WHERE se.id IN (
  SELECT DISTINCT ON ("playedGameId") id
  FROM "ScoreEntry"
  ORDER BY "playedGameId", score DESC
);
```

This is best-effort: for historical games where the highest `score` isn't actually the winner (time games stored as seconds, ranking games, `winCondition='low'`), the wrong player gets `isWinner=true`. We do NOT attempt to auto-fix because the raw `score` values on those old rows aren't trustworthy to begin with. Users can manually edit those sessions if they care.

The `points-winner` hotfix from commit `1ba323d` remains valid — it already writes `score=entered` on the winner and `score=0` on losers; the backfill picks the winner correctly (highest score is the entered value, losers are 0).

---

## Log form UX (adaptive per winType)

Step 1 (participant selection) is unchanged. Step 2's content branches on `winType`.

### `points-all` (unchanged flow + `winCondition` now respected)

- Per-player score inputs, one per `scoreField`, summed client-side for preview
- Server: `score` = sum per player; `isWinner=true` for max sum (or min if `winCondition='low'`)
- Tie: if multiple players share the max/min sum, all get `isWinner=true` (shared win). Document as intentional.

### `points-winner` (as shipped in hotfix)

- Winner radio; single score input appears once winner is picked
- `score = entered` for winner, `0` for others; `isWinner=true` for winner
- Single scoreField only — if `scoreFields.length > 1`, we still show one input (sum across fields isn't meaningful when only the winner scores). Document.

### `time` — new unit-aware input

Per participant, input format depends on `template.timeUnit`:
- `seconds` → one integer input, placeholder `"45"` → stored as `45`
- `minutes` → one decimal input, placeholder `"4.5"` → stored as `270` (converted to seconds on submit)
- `mmss` → two small inputs side-by-side: `[MM]:[SS]` → stored as `60 * MM + SS`

All store seconds in `score`. Winner:
- Default `winCondition='low'` or null on time templates → fastest (lowest `score`) wins
- `winCondition='high'` (supported but unusual) → slowest wins
- Tie handling: all equally-best players get `isWinner=true`

### `ranking`

- "Positie" numeric input per participant, `1..N`
- Client validation: each rank unique, no gaps, in `1..N`
- Server re-validates; error key `'invalidRanks'`
- Storage: `rank = entered`; `score = N + 1 - rank` (so existing sort-desc ordering puts rank 1 at top for any lingering display code that hasn't been updated); `isWinner=true` for rank 1

### `elimination`

Two variants by `template.trackEliminationOrder`:

**Off (default):**
- Winner radio only (last one standing)
- `isWinner=true` for winner; `score=1/0`; no `eliminationOrder` set

**On:**
- Heading: "In welke volgorde werden spelers uitgeschakeld?"
- Per participant: numeric input "uitgeschakeld als #" (1 = first out). Leave empty for "last alive"
- Client validation: at most one empty; filled values unique in `1..N-1`
- Server error key `'invalidEliminationOrder'`
- Storage: `eliminationOrder` per player; the player with empty order gets `isWinner=true` and `score=1`; everyone else `score=0`

### `winner`

- Winner radio (unchanged)
- If `template.rolesEnabled && template.roles.length > 0`: dropdown per participant, options = `template.roles`, value optional
- Server: `role` set per `ScoreEntry.role` when provided; `isWinner=true` for winner; `score=1/0`

### `cooperative`

- Heading: single toggle — "Hebben jullie gewonnen?" → `true / false`
- If `template.trackDifficulty`: free-text input "Moeilijkheidsgraad" below, placeholder `"bijv. medium, hard, nightmare"`
- Storage: `isWinner = teamWon` for ALL participants; `score = 1` if won, `0` if lost (uniform). `PlayedGame.difficulty` set from input.

### `team` — dynamic structured flow

Step 2a — count + names:
- "Hoeveel teams?" number input (min 2, default 2, max equals participant count / 2 rounded down)
- Once filled, reveals N text inputs for team names (defaults: `"Team 1"`, `"Team 2"`, …)

Step 2b — per-player assignment:
- For each participant, dropdown of the team names entered above
- Validation: every participant assigned to a team; each team has at least one player

Step 2c — winning team:
- Radio among the team names

Step 2d — optional team scores:
- If `template.trackTeamScores`: one numeric input per team (labelled with team name)

Storage:
- `PlayedGame.teams = ['Red', 'Blue']`
- `ScoreEntry.team` per player
- `isWinner = true` for every player on the winning team; others `false`
- `score = 1/0` uniformly by winner status (raw team scores live in `PlayedGame.teamScores`, not in `ScoreEntry.score`)
- `PlayedGame.teamScores = [{ name: 'Red', score: 12 }, { name: 'Blue', score: 8 }]` when tracked, else `null`

### `secret-mission` (unchanged)

- Winner radio + mission dropdown from `template.missions`
- `isWinner=true` for winner; `score=1/0`; `PlayedGame.winningMission` set

### Shared form elements

- `playedAt` datetime input (default = now rounded to 5 min)
- `notes` textarea
- Credit-cost banner on create (not edit)
- Submit button disabled while `loading` or when any branch-specific validation fails
- All error messages via `toast.error(tErrors(key))` using existing error key pattern

---

## Display changes

Every site currently rendering `scores[0]` as the winner switches to `scores.find(s => s.isWinner)` (single-winner types) or `scores.filter(s => s.isWinner)` (cooperative / team).

### Affected files

- `src/app/app/leagues/[id]/page.tsx` — played-games list (old inline layout — replaced by phase 9's `PaginatedGamesTable verbose` variant anyway, but the per-row score display needs winType handling)
- `src/components/stats/PaginatedGamesTable.tsx` — `compact` and `verbose` rows both currently show "Winnaar: X" based on `scores[0]`. Switch to `isWinner` filter. When multiple winners (coop / team), label becomes:
  - Cooperative: "Gewonnen" or "Verloren" (no per-person name)
  - Team: "Winnaar: Red (Alice, Bob)" — team name with member list, or "Verloren"
- Share page at `src/app/share/[token]/page.tsx` (if present — same treatment)
- `PendingApprovalSection.tsx` — same treatment

### Per-type display rendering

Each row in the games table picks a renderer based on `winType` (passed through from `loadGames`):

| winType | Row shows |
|---|---|
| `points-all`, `points-winner` | inline score list `Alice 45 · Bob 38 · …`, winner bolded |
| `time` | inline time list formatted per `timeUnit` — `Alice 4:30 · Bob 5:12` |
| `ranking` | inline rank list `#1 Alice · #2 Bob · #3 Carol` |
| `elimination` (no order) | just "Winnaar: X" plus player list |
| `elimination` (ordered) | "Winnaar: X" + list showing elimination order inline (e.g., "#3 Alice (uitgeschakeld)") |
| `winner` | "Winnaar: X" + roles listed if any (`Alice (Mage) · Bob (Warrior)`) |
| `secret-mission` | "Winnaar: X via Missie-naam" |
| `cooperative` | "Gewonnen — difficulty: hard" or "Verloren" (no player-level score line) |
| `team` | "Winnaar: Red" — grouped under team headers: `Red: Alice, Bob (12)` / `Blue: Carol, Dave (8)` — scores only if `trackTeamScores` |

`GameRow` type in `loadGames` grows to expose these fields:

```ts
type GameRow = {
  id: string
  gameName: string
  leagueName: string
  playedAt: string
  winType: WinType
  winCondition: 'high' | 'low' | null
  timeUnit: 'seconds' | 'minutes' | 'mmss' | null
  scores: {
    playerName: string
    score: number
    isWinner: boolean
    role: string | null
    team: string | null
    rank: number | null
    eliminationOrder: number | null
  }[]
  winnerNames: string[]   // derived — players where isWinner=true (empty for cooperative-loss)
  difficulty: string | null
  teams: string[]
  teamScores: { name: string; score: number }[] | null
  winningMission: string | null
  notes: string | null
  shareToken: string | null
  userWon: boolean | null   // viewer's player isWinner, or null if viewer not in game
}
```

### Time formatting helper

```ts
// src/lib/game-logic/formatTime.ts
export function formatTime(seconds: number, unit: 'seconds' | 'minutes' | 'mmss' | null): string {
  if (unit === 'minutes') return `${(seconds / 60).toFixed(1)} min`
  if (unit === 'mmss') {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${seconds}s`
}
```

---

## Stats aggregator updates

All aggregators switch from `scores[0]` to `isWinner`. `AggregatorGame` already needs `league.gameTemplate`; we extend the `select` to include `winType`, `winCondition`, `timeUnit`, `trackEliminationOrder`, `trackTeamScores`, `trackDifficulty`.

### Changes per aggregator

- **`computeRanking`** — win count per player = sum of `isWinner === true` across their `ScoreEntry`s
- **`computeScoreRecords`** — ONLY counts games where comparing raw `score` is meaningful: `points-all`, `points-winner`. Skips `time`, `ranking`, `cooperative`, `team`, `winner`, `secret-mission`, `elimination`. Add a new field `fastestTime: { playerName, seconds, playedAt } | null` that looks at games with `winType='time'` — fastest = min `score`, fallbacks respect `winCondition`. Display gets a new "snelste tijd" row inside the Score Records panel.
- **`computeStreaks` / `computeRecentForm`** — "did player X win game Y" = `ScoreEntry.isWinner` for player X in game Y. Cooperative sessions count per session (all participants win or all lose together). Team sessions count per player (on winning team = win).
- **`computeHeadToHead`** — skip pairs within the same team (both won or both lost — meaningless). Skip cooperative games entirely. For other types, pairwise comparison becomes "A.isWinner && !B.isWinner".
- **`computeMissionStats`** — unchanged.
- **`computeWinTrend`** — count cumulative wins via `isWinner`.

### Type plumbing

`AggregatorGame` grows:

```ts
type AggregatorGame = {
  // existing
  league: {
    id: string
    name: string
    gameTemplate: {
      name: string
      missions: string[]
      winType: WinType
      winCondition: 'high' | 'low' | null
      timeUnit: 'seconds' | 'minutes' | 'mmss' | null
    }
  }
  scores: {
    // existing: playerId, score, player: { ... }
    isWinner: boolean
    role: string | null
    team: string | null
    rank: number | null
    eliminationOrder: number | null
  }[]
  // new
  difficulty: string | null
  teams: string[]
  teamScores: { name: string; score: number }[] | null
}
```

`fetchGames` in `loadStats.ts` updates its Prisma `select`/`include` to pull the new fields.

---

## Testing

### Unit tests — `resolveScoreEntries`

`src/lib/game-logic/resolveScoreEntries.test.ts` — one `describe` block per winType covering:
- Happy path (correct input → correct output)
- Missing required field returns typed error
- Tie handling (shared winner where applicable)
- `winCondition` flipping for `points-all` + `time`
- `trackEliminationOrder` on/off for `elimination`
- Multi-winner correctness for `cooperative` and `team`

### Aggregator fixture helper

Update `src/lib/stats/*.test.ts` fixture builders so games explicitly set `isWinner` flags (rather than relying on sort order). Tests existing in phase 9's plan remain but fixture construction changes.

### Manual smoke test (post-deploy)

1. Create one template per winType via the wizard (9 templates)
2. Log one session each; verify form shows the correct inputs
3. Visit dashboard + the league for each → verify display renders correctly per type
4. Verify stats panels update sensibly (ranking, head-to-head, etc.)

No E2E tests added (matches project convention).

---

## Phase ordering

This is phase **9**; the stats expansion becomes phase **10**. Reason: the stats-expansion aggregators need to query "did this player win" — if we wrote them first against the current `scores[0]` convention, every aggregator would be rewritten immediately after. Doing the winType work first means the aggregators get a consistent `isWinner` contract from day one.

INDEX.md is already updated to reflect this ordering.

---

## Open questions (resolved inline during brainstorm)

- ✅ Scope C selected (blockers + winCondition correctness + extras tracking)
- ✅ `isWinner: Boolean` approach instead of deriving from score
- ✅ Team UX: option C (dynamic count + names + per-player pickers)
- ✅ Elimination order: option C (template-level toggle, new `trackEliminationOrder` field)
- ✅ Cooperative difficulty: free-text at session time, not template-configured levels
- ✅ Roles: dropdown from `template.roles[]`, optional per player
- ✅ Time input: format per `timeUnit` (seconds/decimal-minutes/MM:SS pair)
- ✅ Ranking: numeric input per player (no drag-reorder)
- ✅ Ties: shared winner (multiple `isWinner=true`)
- ✅ Historical data: best-effort backfill via `score DESC`; known-incorrect rows left alone
