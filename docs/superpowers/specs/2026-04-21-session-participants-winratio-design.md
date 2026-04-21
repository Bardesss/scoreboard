# Session Participants & Win Ratio

**Date:** 2026-04-21  
**Status:** Approved

## Overview

Three related improvements to the game logging and stats experience:

1. When logging a session, explicitly select which league members actually played (instead of forcing all members into every game).
2. Use the existing `minPlayers`/`maxPlayers` on `GameTemplate` to validate the participant count during logging.
3. Show a win ratio (wins ÷ games played) per player on the league page and in the dashboard leaderboard.

No database migrations are required. `ScoreEntry` already links players to games — going forward, only actual participants get a row.

---

## Log Form — Two-Phase Flow

The log page (`/app/leagues/[id]/log/page.tsx`) gains a `step` state: `'participants' | 'scores'`.

### Phase 1 — Participant selection

- All league members listed as toggle buttons (same visual style as the current winner picker).
- **None selected by default** — the user must explicitly tap each player who participated.
- A counter shows "X players selected".
- If the template has `minPlayers` / `maxPlayers` set, a hint displays (e.g. "2–5 players"). The Continue button is disabled with a visible note if the selection is outside that range.
- Once the count is valid, "Continue →" advances to phase 2.

### Phase 2 — Scores / winner

- Identical to the current form, but scoped to selected participants only.
- A "← Back" link returns to phase 1 without losing selections or entered scores.
- **Score-based games** (`points-all`, `points-winner`, `time`, `ranking`): winner auto-determined by highest total score on submit — no change to existing logic.
- **Winner-type games** (`winner`, `elimination`, `cooperative`, `team`, `secret-mission`): the winner radio list shows only the selected participants.

---

## API Change

`GET /api/app/leagues/[id]/members` currently returns:

```json
{ "members": [...], "winType": "...", "missions": [...], "scoreFields": [...] }
```

Add `minPlayers` and `maxPlayers` from the linked `GameTemplate`:

```json
{ "members": [...], "winType": "...", "missions": [...], "scoreFields": [...], "minPlayers": 2, "maxPlayers": 5 }
```

Both fields are nullable (`Int?` in schema) — the log form only shows the player count hint when at least one is set.

---

## Win Ratio Calculation

Derived entirely from existing data — no new columns.

- **Games played** = count of `ScoreEntry` rows for a player in a given scope (league or all leagues).
- **Wins** = count where the player has the highest score in that game. For winner-type games this is score = 1; for score-based games it is the maximum score across all entries for that `PlayedGame`.
- **Win ratio** = wins ÷ games played, shown as a percentage (e.g. "40%").

**Historical data note:** Before this change, all league members were added to every game, inflating "games played" for players who didn't actually participate. No backfill — the slight inflation in old records is acceptable.

### League page

The member list on `/app/leagues/[id]/` gains a win ratio badge per player: e.g. `4W / 10G — 40%`. Default sort: win ratio descending. Stats computed server-side at page load; no caching needed (per-user, low traffic).

### Dashboard leaderboard

The existing leaderboard (currently sorted by total wins) gains a win ratio column alongside the win count. Calculation spans all leagues the user owns. Included in the existing Redis cache (300s TTL); cache key structure unchanged — the cached object just gains new fields.

---

## Scope

| Area | Change |
|---|---|
| `GET /api/app/leagues/[id]/members` | Return `minPlayers` + `maxPlayers` |
| Log page (`/leagues/[id]/log/page.tsx`) | Two-phase form: participant picker → scores/winner |
| League page (`/leagues/[id]/page.tsx`) | Win ratio per member |
| Dashboard (`/dashboard/`) | Win ratio in leaderboard |
| Game wizard | No change (min/max already works) |
| Prisma schema | No change |
