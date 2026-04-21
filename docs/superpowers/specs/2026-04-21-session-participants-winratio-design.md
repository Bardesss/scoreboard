# Session Participants, Win Ratio & Session Management

**Date:** 2026-04-21  
**Status:** Approved

## Overview

Five related improvements to the game logging and stats experience:

1. When logging a session, explicitly select which league members actually played (instead of forcing all members into every game).
2. Use the existing `minPlayers`/`maxPlayers` on `GameTemplate` to validate the participant count during logging.
3. Show a win ratio (wins ÷ games played) per player on the league page and in the dashboard leaderboard.
4. Sessions store date **and time** (HH:MM) since multiple sessions are often played in one evening.
5. Sessions can be edited (all fields) and deleted from the league page.

No database migrations are required. `ScoreEntry` already links players to games — going forward, only actual participants get a row.

---

## Date & Time

The `playedAt` field changes from a date-only input (`type="date"`) to a datetime input (`type="datetime-local"`, displaying date + HH:MM). The stored value remains a UTC `DateTime` in the database — no schema change needed. The log form defaults to the current date and time rounded to the nearest 5 minutes.

Existing sessions with no time component (midnight UTC) are unaffected — they display as-is.

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

## Edit & Delete Sessions

### Edit

Each session on the league page has an **Edit** button (pencil icon, owner only). It opens the same two-phase log form pre-populated with the session's existing participants, scores/winner, datetime, and notes. On submit the `PlayedGame` and its `ScoreEntry` records are updated in a transaction (delete old entries, insert new ones).

**Re-approval:** if the session was previously `approved` and the editor is not the league owner, the status resets to `pending_approval` and a notification is sent to the owner. League owners editing their own sessions stay `approved`.

### Delete

Each session has a **Delete** button (trash icon, owner only). Tapping it shows an inline confirmation ("Delete this session? This cannot be undone.") with Cancel and Confirm buttons — no modal. Confirming hard-deletes the `PlayedGame` and cascades to all `ScoreEntry` rows. The dashboard Redis cache is invalidated on delete (same as on log/approve).

---

## Scope

| Area | Change |
|---|---|
| `GET /api/app/leagues/[id]/members` | Return `minPlayers` + `maxPlayers` |
| Log page (`/leagues/[id]/log/page.tsx`) | Two-phase form: participant picker → scores/winner; datetime input |
| League page (`/leagues/[id]/page.tsx`) | Win ratio per member; edit + delete buttons per session |
| Edit session | Reuse log form pre-populated; re-approval logic |
| Delete session | Inline confirmation, hard delete, cache invalidation |
| Dashboard (`/dashboard/`) | Win ratio in leaderboard |
| Game wizard | No change (min/max already works) |
| Prisma schema | No change |
