# Dashboard Redesign — Design Spec

**Date:** 2026-04-22
**Status:** Approved for implementation planning

---

## Goal

Replace the current single-column dashboard (3 stat pills + leaderboard top 5 + recent games top 5) with a richer layout: four full list-panels in a 2×2 grid at the top, and a full paginated played-games table (25/page) at the bottom.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🏆 Ranking (top 10)        │  🎲 Top spellen (top 10)         │
│                             │                                   │
├─────────────────────────────┼───────────────────────────────────┤
│  📅 Speeldagen (all 7)      │  🏅 Leagues (all, sorted)        │
│                             │                                   │
├─────────────────────────────────────────────────────────────────┤
│  Gespeelde partijen — paginated table, 25/page                  │
└─────────────────────────────────────────────────────────────────┘
```

- Desktop: 2-column grid for the four panels. Max content width `max-w-5xl`.
- Mobile: single column (panels stack).
- Page title stays: greeting + subtitle.

---

## The Four Panels

### Panel 1 — Ranking

**Data:** All approved `PlayedGame` records in leagues owned by the current user. Aggregate all players across all those games: win count + games played → win ratio. Sort by wins descending, take top 10.

**Display:** Numbered list 1–10. Positions 1–3 amber number, rest grey. Each row: `#` · player name · win count · win ratio %. The current user's row(s) highlighted with a faint amber background. "You" indicated by highlighting (player where `player.userId === session.user.id`).

**Edge case:** Fewer than 10 players across all leagues → show however many exist.

---

### Panel 2 — Top spellen

**Data:** Group `PlayedGame` records by `league.gameTemplate.name`. For each template: total play count + the current user's personal win ratio (how often the user's player was the top scorer in that template). Sort by total play count descending, take top 10.

**Display:** Numbered list 1–10 with: rank · game name · `N×` play count · user's win ratio (`—` if user has no scores in that game).

---

### Panel 3 — Speeldagen

**Data:** Group all approved `PlayedGame` records by `DAYOFWEEK(playedAt)`. Count sessions per weekday. Sort by count descending (all 7 days shown, even if count is 0).

**Display:** All 7 days as a ranked bar chart. Each row: day name (Dutch) · session count · proportional horizontal bar. Top day gets amber bar, rest get the muted colour. Zero-count days shown dim at the bottom.

---

### Panel 4 — Leagues

**Data:** All leagues owned by the current user. For each: count approved `PlayedGame` records + find the most recent `playedAt`. Sort by game count descending.

**Display:** List of all user's leagues. Each row: league name · player count · "laatste: X" recency label · session count (`N×`). No top-10 limit — show all leagues.

---

## Played-Games Table (paginated)

**Data:** All approved `PlayedGame` records in leagues owned by the current user, ordered by `playedAt DESC`. 25 per page, offset-based (`?page=N`, defaults to 1).

**Columns:** Spel · League / Datum / Spelers (comma-joined names) / Uitslag (won/lost badge)

**Won/lost logic:** The current user wins if any of their players (`player.userId === session.user.id`) has the highest score in that game. If the current user has no player entry in that game, show no badge (empty cell).

**Won badge:** amber `#fff3d4` background, `#c27f0a` text.
**Verloren badge:** muted `#f2ece3` background, `#6b5e4a` text.

**Pagination:** Prev/Next buttons. Prev disabled on page 1. Shows "Pagina N van M · 25 per pagina".

---

## Architecture

### Files changed / created

**New:**
- `src/app/app/dashboard/DashboardClient.tsx` — client component: renders the four panels + games table with pagination controls. Receives all data as props (no client-side fetching).

**Modified:**
- `src/app/app/dashboard/page.tsx` — server component. Loads all stats + paginated games for requested page. Passes as props to `DashboardClient`. Keeps Redis cache for stat panels (5-min TTL, cache key `cache:dashboard:stats:{userId}`). Games list is not cached (changes on every new game).

### Data loading split

`page.tsx` makes two parallel queries:

```ts
const [stats, games] = await Promise.all([
  loadDashboardStats(userId),          // cached 5 min
  loadPlayedGames(userId, page, 25),   // not cached
])
```

**`loadDashboardStats(userId)`** returns:
```ts
type DashboardStats = {
  ranking: { name: string; avatarSeed: string; wins: number; gamesPlayed: number; winRatio: number; isCurrentUser: boolean }[]
  topGames: { name: string; count: number; userWinRatio: number | null }[]
  playDays: { day: number; label: string; count: number }[]   // day 0=Sun … 6=Sat
  leagues: { id: string; name: string; playerCount: number; sessionCount: number; lastPlayedAt: string | null }[]
}
```

**`loadPlayedGames(userId, page, perPage)`** returns:
```ts
type GamesPage = {
  games: { id: string; gameName: string; leagueName: string; playedAt: string; playerNames: string[]; userWon: boolean }[]
  total: number
  page: number
  totalPages: number
}
```

### Caching

- Stat panels: Redis key `cache:dashboard:stats:{userId}`, TTL 300s. Invalidated when a new `PlayedGame` is approved (same pattern as existing cache invalidation elsewhere in the codebase).
- Games list: no cache. Fetched fresh per page load.

### Pagination

`page.tsx` reads `searchParams.page` (number, min 1). Passed to `loadPlayedGames`. `DashboardClient` renders prev/next links (`href="?page=N"`) — plain anchor navigation, no JS required.

### Layout

- Container: `max-w-5xl mx-auto py-8 px-4`
- Panels grid: `grid grid-cols-1 md:grid-cols-2 gap-4 mb-6`
- Each panel: `rounded-2xl` card, `background: #fefcf8`, `border: 1px solid #c5b89f`
- Panel header: bottom border separator, title in `font-headline` bold, subtitle in muted secondary text
- Games table: same card chrome, column header row in `#f2ece3` bg

---

## i18n

Add keys to `app.dashboard` namespace in `nl.json` and `en.json`:

| Key | NL | EN |
|---|---|---|
| `ranking` | Ranking | Rankings |
| `topGames` | Top spellen | Top games |
| `playDays` | Speeldagen | Play days |
| `leagues` | Leagues | Leagues |
| `gamesTable` | Gespeelde partijen | Played games |
| `won` | Gewonnen | Won |
| `lost` | Verloren | Lost |
| `page` | Pagina {page} van {total} | Page {page} of {total} |
| `prev` | ← Vorige | ← Previous |
| `next` | Volgende → | Next → |
| `perPage` | 25 per pagina | 25 per page |

---

## Out of Scope

- Filtering the games table by league or game
- Sorting columns in the games table
- Animated entry / skeleton loaders
- Per-league ranking breakdown
- Clicking a game row to see detail (link to existing share page is fine if already wired)
