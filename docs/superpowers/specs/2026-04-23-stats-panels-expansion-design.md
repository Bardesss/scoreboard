# Stats Panels Expansion — Design Spec

**Date:** 2026-04-23
**Status:** Approved for implementation planning
**Covers:** League page stats redesign + dashboard expansion + shared stat primitives + date filter + skeleton loaders + animations + charts + i18n sweep

---

## Goal

Turn the league detail page into a rich stats view comparable to (and extending) the dashboard: 9 stat panels + paginated games table. At the same time, extract reusable panel primitives so dashboard and league page share a single source of truth for styling and behaviour. Add a date filter, skeleton loaders, bar-growth + number count-up animations, Recharts-based charts where a chart is genuinely more informative than a list, and a proper i18n sweep for all panel labels.

---

## Scope

### In scope
- Extract shared panel primitives to `src/components/stats/`
- Refactor `DashboardClient.tsx` to use the new primitives (no visible change beyond the additions below)
- Rewrite `src/app/app/leagues/[id]/page.tsx` to a stats-centric layout using `LeagueStatsClient.tsx`
- Add 2 new panels to the dashboard: **Most-won missions** (chart) + **Games frequency** (chart)
- Add 9 panels + paginated table to the league page (with hide rules)
- Date filter component (preset buttons + custom date range) on both pages, affecting stats AND games table
- `loading.tsx` skeletons for both routes
- `useTransition`-driven dimming on filter / pagination changes
- CSS animations: bar width growth, panel fade-in stagger
- `<AnimatedNumber>` component for headline numbers on each panel
- Mobile-optimised head-to-head view (per-player condensed list at `<640px`)
- i18n sweep: all panel labels, column headers, chip labels, pagination controls, recency strings → translation keys (nl + en)

### Out of scope
- Per-member drill-down pages ("click a member → see their stats")
- Exporting stats (CSV / PDF)
- Filtering the games table by specific players or specific missions
- Replacing the dashboard greeting ("Goedemiddag") — kept literal
- Snapshot testing the panel UI
- E2E tests
- Server-side rendering of Recharts components — chart components are `'use client'`

---

## Architecture

### File map

**New shared components in `src/components/stats/`:**

| File | Role |
|---|---|
| `Card.tsx` | Panel shell — background, border, radius, overflow |
| `PanelHeader.tsx` | Title + optional subtitle, bottom separator |
| `RankedListRow.tsx` | Numbered row (rank · optional avatar · name · metric cells) |
| `StatBar.tsx` | Label + value + proportional horizontal bar |
| `PaginatedGamesTable.tsx` | Prev/Next paginated table. `variant: 'compact' \| 'verbose'` |
| `DateFilter.tsx` | Client component. Preset buttons + custom date range inputs, writes to URL |
| `StatsSkeleton.tsx` | Pulsing gray placeholder matching panel shapes |
| `AnimatedNumber.tsx` | Client. Count-up animation from 0 on mount |
| `MissionChart.tsx` | Client. Recharts horizontal bar chart |
| `WinTrendChart.tsx` | Client. Recharts multi-line chart (cumulative wins per top-5 player) |
| `GamesFrequencyChart.tsx` | Client. Recharts vertical bar chart (games per week / month) |
| `HeadToHeadGrid.tsx` | N×N matrix with mobile-list fallback |

**New aggregation helpers in `src/lib/stats/`:**

| File | Export |
|---|---|
| `ranking.ts` | `computeRanking(games, viewerId?) → RankingEntry[]` |
| `headToHead.ts` | `computeHeadToHead(games, members) → HeadToHeadMatrix` |
| `missions.ts` | `computeMissionStats(games) → MissionStat[] \| null` |
| `streaks.ts` | `computeStreaks(games, members) → StreakEntry[] \| null` |
| `recentForm.ts` | `computeRecentForm(games, members) → RecentFormRow[] \| null` |
| `scoreRecords.ts` | `computeScoreRecords(games) → ScoreRecords` |
| `playDays.ts` | `computePlayDays(games) → PlayDay[]` |
| `gamesFrequency.ts` | `computeGamesFrequency(games, dateRange) → FrequencyBucket[]` |
| `winTrend.ts` | `computeWinTrend(games, members) → WinTrendSeries \| null` |
| `dateRange.ts` | `parseRange(searchParams) → DateFilter`, `rangeToWhere(filter) → Prisma WhereInput` |
| `loadStats.ts` | `loadStats(scope, filter) → StatsBundle` — orchestrator, handles Redis caching |
| `loadGames.ts` | `loadGames(scope, filter, page, perPage) → GamesPage` |

**Refactored:**
- `src/app/app/dashboard/DashboardClient.tsx` — stops using inline card styles, uses primitives. Visible change: Missions chart + Games frequency chart added, date filter at top, translations.
- `src/app/app/dashboard/page.tsx` — reads `searchParams.range`, `from`, `to`, `page`. Passes range-filtered data.

**Created:**
- `src/app/app/leagues/[id]/LeagueStatsClient.tsx` — composes the 9 panels + verbose games table
- `src/app/app/dashboard/loading.tsx` — skeleton for dashboard route
- `src/app/app/leagues/[id]/loading.tsx` — skeleton for league route

**Modified:**
- `src/app/app/leagues/[id]/page.tsx` — two parallel loaders (`loadLeagueStats` + `loadLeagueGames`), passes props to `LeagueStatsClient`. Keeps header, pending-approval section, SessionActions wiring. Removes inline member pills (Ranking panel replaces them) and inline played-games list (`PaginatedGamesTable` replaces it)
- `messages/nl/app.json` + `messages/en/app.json` — add all new keys under `app.stats.*`

**Unchanged:** `PendingApprovalSection.tsx`, `ShareButton.tsx`, `SessionActions.tsx`, Prisma schema.

### Data flow

```
page.tsx (server)
  ├─ auth + param parsing
  ├─ Parallel:
  │    ├─ loadStats(scope, range) → StatsBundle    [Redis-cached per scope+range]
  │    └─ loadGames(scope, range, page) → GamesPage [not cached]
  └─ <Client stats={...} games={...} range={...} />

<Client> (server component, no 'use client')
  ├─ <DateFilter current={range} />           [client child]
  ├─ 2-col grid of panels
  │    ├─ Card > PanelHeader > content
  │    └─ content is either a list (server) or a chart (client)
  └─ <PaginatedGamesTable variant="..." />
```

### Scope abstraction

A single internal type `StatsScope = { kind: 'user'; userId: string } | { kind: 'league'; leagueId: string; viewerId: string }` lets `loadStats` and the aggregator helpers take one parameter. The scope controls the `where` clause on `prisma.playedGame.findMany`.

---

## Date filter

### URL shape

`?range=week|month|year|all|custom&from=YYYY-MM-DD&to=YYYY-MM-DD&page=N`

- Default `range=all`, `page=1`
- Changing the range resets `page` to 1
- `from` / `to` only read when `range=custom`; otherwise ignored
- Custom range requires both `from` and `to`; if malformed, falls back to `all` silently

### Presets (labels from i18n)

| Key | NL | EN | Semantics |
|---|---|---|---|
| `week` | Deze week | This week | ISO week, Mon 00:00 → now |
| `month` | Deze maand | This month | 1st of current month 00:00 → now |
| `year` | Dit jaar | This year | Jan 1 00:00 → now |
| `all` | Alles | All time | No date filter |
| `custom` | Aangepast | Custom | Uses `from` / `to` |

### Filter component

`<DateFilter>` is a client component. Row of preset pills (amber when active, muted otherwise) + a "Custom" pill that reveals two `<input type="date">` fields. Submitting custom dates pushes a new URL. Preset clicks push `?range=<key>&page=1`.

### Scope

Filter applies to **both** stats panels and the games table. When the range changes, both re-compute. Range-specific data never leaks across tabs because everything is URL-driven.

### Cache key

- `cache:stats:user:{userId}:{range}` (where range ∈ `week|month|year|all`)
- `cache:stats:league:{leagueId}:{range}`
- `range=custom` skips cache entirely

TTL: 300s (same as current dashboard cache).

### Active cache invalidation

On PlayedGame create / edit / delete / approve, delete all per-range keys for the affected league AND for the owner's user-scope:
```ts
await Promise.all([
  ['week', 'month', 'year', 'all'].map(r => redis.del(`cache:stats:user:${ownerId}:${r}`)),
  ['week', 'month', 'year', 'all'].map(r => redis.del(`cache:stats:league:${leagueId}:${r}`)),
].flat())
```

Call sites:
- `src/app/app/leagues/[id]/log/actions.ts`
- Session edit/delete actions referenced by `SessionActions`
- PlayedGame approval action in the admin / league owner flow

---

## Panels

All panels are rendered inside a `<Card>` with a `<PanelHeader>`. A panel "hides" by returning `null` when its hide rule fires — the parent grid compacts automatically via CSS grid `auto-fit` on the relevant breakpoint.

### Panel index — dashboard

| # | Panel | Source |
|---|---|---|
| 1 | Ranking | existing |
| 2 | Top spellen | existing |
| 3 | Speeldagen | existing |
| 4 | Leagues | existing |
| 5 | Most-won missions | **NEW** — chart |
| 6 | Games frequency | **NEW** — chart |

### Panel index — league page

| # | Panel | Hide rule | Subsection |
|---|---|---|---|
| 1 | Ranking | — | §1 |
| 2 | Head-to-head | `members.length > 8` | §7 |
| 3 | Speeldagen | — | §3 |
| 4 | Missions (chart) | `template.missions.length === 0` OR no `winningMission` values | §5 |
| 5 | Win streaks | `playedGames.length < 3` | §9 |
| 6 | Recent form | `playedGames.length < 3` | §10 |
| 7 | Score records | — | §11 |
| 8 | Win trend (chart) | `playedGames.length < 3` | §12 |
| 9 | Games frequency (chart) | — | §6 |

### 1. Ranking (both pages)

**Data.** Every player who appears in any scoped approved `PlayedGame`. Per player: `wins`, `gamesPlayed`, `winRatio = round(wins/gamesPlayed * 100)`, `isCurrentUser = player.userId === viewerId`.

**Display.** `RankedListRow` per player, top 10 (dashboard) or all members (league). Positions 1–3 amber rank number, rest muted. Amber background tint + bold weight on `isCurrentUser` rows. Columns: rank · avatar (24px) · name · `N wins` · `R%`.

### 2. Top spellen (dashboard only)

**Data.** Group approved games by `league.gameTemplate.name`. Per template: play count + current user's personal winRatio (user's players as a fraction of total-scores-in-that-template).

**Display.** `RankedListRow` per template, top 10. Rank · name · `N×` count · `R% wr` (or `—` if user has no scores in that template).

### 3. Speeldagen (both pages)

**Data.** Group scoped approved games by `DAYOFWEEK(playedAt)`. Count per weekday. Sort desc (ties broken by Sunday-first).

**Display.** 7 rows × `StatBar`. Each row: day label (localised) · count · proportional bar. Top day gets amber bar + 🔥 suffix. Zero-count days muted grey.

### 4. Leagues (dashboard only)

**Data.** All leagues owned by the user. Per league: `playerCount`, `sessionCount` (scoped-range count), `lastPlayedAt` (scoped-range max).

**Display.** Ranked list sorted by `sessionCount` desc. Row: name (bold for top) · "N speler(s) · laatste: X" · `sessionCount ×`. Recency helper: `vandaag / gisteren / N dagen geleden / 1 week geleden / N weken geleden / N maanden geleden`.

### 5. Most-won missions (dashboard = chart, league = chart)

**Data.**
- Dashboard: group all approved games across user's leagues by `winningMission`, count. Filter null.
- League: group approved games in this league by `winningMission`, count. Filter null.

**Display.** `<MissionChart>` — Recharts `BarChart` `layout="vertical"`. Bars ranked by count. Amber fill for top-1, muted for rest. Height 220px. If 1–2 missions, falls back to `RankedListRow` list layout (charts with one bar look broken).

**Hide rule:** no mission data at all.

### 6. Games frequency (both pages, chart)

**Data.** Bucket approved games by `week` or `month` over the selected range. Bucket width:
- Range covers ≤ 2 months → weekly buckets (Mon–Sun)
- Range > 2 months OR `all` → monthly buckets (1st of month)

**Display.** `<GamesFrequencyChart>` — Recharts `BarChart`. X-axis: bucket labels. Y-axis: game count. Bars amber. Tooltip shows bucket label + exact count. Height 220px.

### 7. Head-to-head (league only)

**Data.** For each ordered pair (A, B) of league members where both have scored in at least one game together: count of games where A finished above B.

**Display.**
- **Desktop (≥640px):** `<HeadToHeadGrid>` — N×N table. Row player on the left, column player on top. Cell shows count of row-player wins over column-player. Diagonal dimmed. Cells where row-player leads get amber tint. Horizontal-scroll container when N×N exceeds container width.
- **Mobile (<640px):** per-player vertical list. Each row shows the member's name + "beste matchup: X (W–L)" + "slechtste: Y (W–L)". Computed from the same matrix.

**Hide rule:** `members.length > 8`. At that point, show a single note card: "Te veel spelers voor head-to-head weergave".

### 9. Win streaks (league only)

**Data.** For each member, walk approved games in this league chronologically. `currentStreak` = count of consecutive most-recent games where the member finished #1 (0 if last game they played was a loss). `longestStreak` = max run of consecutive wins ever. Filter out members with 0 total wins.

**Display.** Ranked list sorted by `longestStreak` desc, then `currentStreak` desc. Row: avatar · name · `nu: N` (amber if ≥2) · `langste: M`.

**Hide rule:** `playedGames.length < 3`.

### 10. Recent form (league only)

**Data.** Per member, last 5 approved games they played in. For each: `W` if finished #1, `L` otherwise. Games they didn't play are skipped entirely (not counted against "last 5").

**Display.** Row per member. Avatar · name · chip sequence (amber W, muted L chips). Newest on the left. Same "you" highlight as Ranking.

**Hide rule:** `playedGames.length < 3`.

### 11. Score records (league only)

**Data.** Over scoped approved games:
- `highestScore` = max single `ScoreEntry.score` + player name + playedAt
- `highestLosingScore` = max `ScoreEntry.score` among players who did NOT finish #1 (requires games with ≥2 players)
- `averageWinnerScore` = mean of all #1 `score` values, rounded

**Display.** Single card with 3 labelled rows (no list rank number). Example:
```
Hoogste score ooit      Alice  ·  128  ·  14 apr 2026
Hoogste verliesscore    Bob    ·  98   ·  14 apr 2026
Gemiddeld winnaar       79
```

### 12. Win trend (league only, chart)

**Data.** Approved games in this league ordered by `playedAt` ascending. Top-5 players by total wins. Per game index (1, 2, 3…), cumulative wins per top-5 player. Non-top-5 players excluded from the chart for readability.

**Display.** `<WinTrendChart>` — Recharts `LineChart`. X-axis: game number. Y-axis: cumulative wins. One line per top-5 player, coloured via `player.avatarSeed` → stable hash → palette. Legend above chart. Height 260px.

**Hide rule:** `playedGames.length < 3`.

---

## Paginated games table

### Compact variant (dashboard)

4 columns, one row per game. Unchanged from current dashboard.

### Verbose variant (league)

Two-line row:

```
┌────────────────────────────────────────────────────────────┐
│  14 apr 2026 · 20:30   Winnaar: Alice   [📝]  [⋯]          │  line 1
│  Alice 45 · Bob 38 · Charlie 22 · David 18                 │  line 2
└────────────────────────────────────────────────────────────┘
```

- **Line 1:** datum + tijd (only when non-midnight) · "Winnaar: X" · optional note icon (title attribute reveals full note) · `SessionActions` edit/delete menu
- **Line 2:** inline score list, player names + scores separated by ` · `, highest-first order
- Row gets amber tint (`rgba(245,166,35,0.04)`) when any of the viewer's players finished #1 in this game
- No click-through, no expandable state

### Pagination

Prev / Next `<Link>` with URL `?range=...&page=N` (preserves range). 25 per page. Footer: "pagina N van M · 25 per pagina" (localised).

### Loading state

During range / page navigation, the surrounding `<LeagueStatsClient>` wraps the table and panels in a container that gets `opacity: 0.4 + spinner overlay` via `useTransition().isPending`. The `<DateFilter>` component owns the transition.

---

## Skeletons

### `loading.tsx` (per route)

Full-page skeleton, rendered by Next.js during initial server fetch:

- Reuses `<DateFilter>` skeleton state (preset pills visible, none active)
- 2-col grid of 6 (dashboard) or 9 (league) skeleton cards
- Each skeleton card: header bar (14px tall, 50% width) + 5 list rows (9px tall, varying widths) OR a 220px chart-area rectangle
- Pulsing `@keyframes pulse` on the gray placeholders (1.2s ease-in-out infinite)

### Transition dimming

On filter / pagination changes (both of which are URL-driven Link clicks), `<DateFilter>` wraps the navigation in `startTransition`. The panels parent reads `useTransition().isPending` and applies `opacity: 0.4 transition: opacity 150ms` + a small spinner in the top-right corner.

Implementation note: `useTransition` state lives in the filter. The panels parent receives `isPending` as a prop from the filter's parent (single client component wrapping both).

---

## Animations

### Bar growth

Rows using `<StatBar>` animate `width` from 0 to target on mount. Pure CSS:

```css
@keyframes grow {
  from { width: 0; }
  to { width: var(--target-width); }
}
.stat-bar { animation: grow 400ms cubic-bezier(0.2, 0, 0, 1); }
```

Only runs on first mount of each row (CSS animations don't retrigger on re-render).

### Panel fade-in stagger

Each `<Card>` gets `animation: fade-up 300ms ease-out backwards` with `animation-delay: calc(var(--panel-index) * 50ms)`. `--panel-index` set inline by the client composition. Max delay capped at 400ms (panel 9 = 400ms).

### Number count-up

`<AnimatedNumber value={N}>` — client component, uses `requestAnimationFrame` to animate from 0 → `value` over 600ms, cubic-bezier(0.2, 0, 0, 1). Applied only to the top-row / headline metric on each panel: Ranking #1 wins count, PlayDays top-day session count, Win streaks top-1 `longestStreak`, Score records `highestScore` value, games table "N totaal" count. Not applied to every row (would feel noisy).

### Recharts mount animation

Built-in. `isAnimationActive` defaults to `true`. No additional work.

### No animations on

- Table rows (too many, would feel janky on pagination)
- Avatar / chip mount
- Text labels

---

## Mobile

- 2-col grid collapses to 1 column at `<640px` (Tailwind `sm:` breakpoint)
- Head-to-head replaces the N×N grid with the per-player condensed list at `<640px`
- Games frequency chart height drops from 220px to 180px on mobile
- `<DateFilter>` preset pills wrap to 2 rows if needed; custom-range inputs stack vertically

---

## i18n

All hardcoded Dutch strings in `DashboardClient.tsx` AND new panel code use `getTranslations({ locale, namespace: 'app.stats' })`. New key set:

### `messages/nl/app.json` — `app.stats`

```jsonc
{
  "ranking": "Ranking",
  "rankingSubtitle": "alle leagues",
  "topGames": "Top spellen",
  "topGamesSubtitle": "meest gespeeld",
  "playDays": "Speeldagen",
  "leaguesPanel": "Leagues",
  "leaguesSubtitle": "meest actief",
  "missions": "Meest gewonnen missies",
  "missionsEmpty": "Geen missies geregistreerd",
  "gamesFrequency": "Speelfrequentie",
  "headToHead": "Onderlinge resultaten",
  "headToHeadTooMany": "Te veel spelers voor head-to-head weergave",
  "streaks": "Winstreeks",
  "streaksCurrent": "nu: {count}",
  "streaksLongest": "langste: {count}",
  "recentForm": "Recente vorm",
  "recentFormWon": "W",
  "recentFormLost": "V",
  "scoreRecords": "Recordscores",
  "scoreRecordsHighest": "Hoogste score ooit",
  "scoreRecordsHighestLoss": "Hoogste verliesscore",
  "scoreRecordsAvgWinner": "Gemiddeld winnaar",
  "winTrend": "Winst-trend",
  "gamesTable": "Gespeelde partijen",
  "gamesTableWinner": "Winnaar: {name}",
  "wins": "{count} wins",
  "winRatio": "{ratio}%",
  "playCount": "{count}×",
  "playCountSessies": "{count} sessies",
  "playerCount": "{count} speler",
  "playerCountPlural": "{count} spelers",
  "empty": "Nog geen partijen gespeeld.",
  "emptyLeagues": "Nog geen leagues aangemaakt.",
  "recencyToday": "vandaag",
  "recencyYesterday": "gisteren",
  "recencyDays": "{count} dagen geleden",
  "recencyOneWeek": "1 week geleden",
  "recencyWeeks": "{count} weken geleden",
  "recencyMonths": "{count} maanden geleden",
  "recencyNever": "nooit gespeeld",
  "pagination": "pagina {page} van {total}",
  "paginationPerPage": "{count} per pagina",
  "prev": "← Vorige",
  "next": "Volgende →",
  "rangeWeek": "Deze week",
  "rangeMonth": "Deze maand",
  "rangeYear": "Dit jaar",
  "rangeAll": "Alles",
  "rangeCustom": "Aangepast",
  "rangeFrom": "Van",
  "rangeTo": "Tot",
  "totalPrefix": "{count} totaal"
}
```

### `messages/en/app.json` — same keys, English values

### Dashboard greeting

`"Goedemiddag, {name} 👋"` — kept hardcoded. Refactoring to time-of-day localisation is deferred to a separate phase.

### Day-of-week labels

Switch `DAY_LABELS_NL` constant to use `date.toLocaleDateString(locale, { weekday: 'long' })` at render time, so nl + en both work without translation keys.

---

## Testing

### Unit tests (vitest)

Pure functions over `PlayedGame[]` in `src/lib/stats/`:

| Test file | Functions covered |
|---|---|
| `src/lib/stats/ranking.test.ts` | `computeRanking(games, viewerId?)` |
| `src/lib/stats/headToHead.test.ts` | `computeHeadToHead(games, members)` |
| `src/lib/stats/missions.test.ts` | `computeMissionStats(games)` |
| `src/lib/stats/streaks.test.ts` | `computeStreaks(games, members)` |
| `src/lib/stats/recentForm.test.ts` | `computeRecentForm(games, members)` |
| `src/lib/stats/scoreRecords.test.ts` | `computeScoreRecords(games)` |
| `src/lib/stats/playDays.test.ts` | `computePlayDays(games)` |
| `src/lib/stats/gamesFrequency.test.ts` | `computeGamesFrequency(games, range)` — bucket selection logic |
| `src/lib/stats/dateRange.test.ts` | `parseRange(searchParams) → { from: Date, to: Date } \| null` |

Each test file covers: happy path, empty input, single-game edge case, hide-rule boundary (e.g. streaks with exactly 3 games).

### Prisma mocks

Reuse existing mock pattern from `src/test/*-actions.test.ts`. Pure aggregation functions don't need DB.

### No snapshot tests

No UI snapshots. Visual regression is out of scope.

### No E2E tests

Matches existing project pattern. Manual smoke test after deploy.

---

## Data models — summary of shapes

### `StatsBundle` (returned by `loadStats`)

```ts
type StatsBundle = {
  ranking: RankingEntry[]           // both
  topGames?: TopGame[]              // dashboard only
  leagues?: LeagueStat[]            // dashboard only
  playDays: PlayDay[]               // both
  missions: MissionStat[] | null    // both — null when no mission data
  gamesFrequency: FrequencyBucket[] // both
  headToHead?: HeadToHeadMatrix     // league only
  streaks?: StreakEntry[] | null    // league only — null when < 3 games
  recentForm?: RecentFormRow[] | null // league only — null when < 3 games
  scoreRecords?: ScoreRecords       // league only
  winTrend?: WinTrendSeries | null  // league only — null when < 3 games
}
```

### `GamesPage` (returned by `loadGames`)

Dashboard `compact` variant:
```ts
{ id, gameName, leagueName, playedAt, playerNames, userWon }
```

League `verbose` variant adds:
```ts
{ ...compact, scores: { playerName, score }[], notes, shareToken }
```

### Range parsing

```ts
type Range = 'week' | 'month' | 'year' | 'all' | 'custom'
type DateFilter = { range: Range; from?: Date; to?: Date }

function parseRange(searchParams): DateFilter { ... }
function rangeToWhere(filter: DateFilter): { playedAt?: { gte: Date; lte?: Date } }
```

---

## Accessibility

- All interactive elements (preset pills, pagination links, custom date inputs) keyboard-reachable
- Focus ring `outline: 2px solid #f5a623; outline-offset: 2px;` on focus-visible
- Bar growth animations respect `prefers-reduced-motion: reduce` — fall back to instant render
- `<AnimatedNumber>` respects the same preference

---

## Performance considerations

- Single DB query for `playedGames` per page load, then all aggregation in memory. 500 games × 5 scores × small joins is well within in-memory aggregation budget.
- Recharts components code-split automatically via Next.js dynamic imports (`'use client'` boundary).
- Skeleton renders within 16ms (no animations during skeleton, just the pulsing keyframe).
- Cache hit returns pre-aggregated JSON directly; no re-computation.

---

## Open questions (resolved inline during brainstorm)

- ✅ All 9 stats on the league page (user: "all")
- ✅ Layout: long 2-column scroll (user: option 1)
- ✅ Extract primitives first (user: option A)
- ✅ Mission panel hidden when empty (user: A)
- ✅ Head-to-head hidden at >8 players (user: B)
- ✅ Streaks / recent form hidden at <3 games (user: B)
- ✅ Games table: two-line rows with inline scores (user: C)
- ✅ "You" tint on league page matches dashboard (user: A)
- ✅ Date filter applies to both stats + games table (user: yes)
- ✅ Custom ranges skip cache (user: yes)
- ✅ Charts where genuinely helpful (user: yes)
- ✅ All extras also apply to dashboard (user: yes)
