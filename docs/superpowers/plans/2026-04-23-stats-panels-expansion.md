# Stats Panels Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract dashboard panel primitives into `src/components/stats/`, add rich league-page stats (9 panels), a shared date filter, skeleton loaders, charts, animations, and a proper i18n sweep — unifying dashboard + league page on one set of primitives.

**Architecture:** Two parallel data loaders (`loadStats` + `loadGames`) per page. Both take a `StatsScope` and a `DateFilter` so dashboard (user-scope) and league-page (league-scope) share the same pipeline. Pure aggregation helpers in `src/lib/stats/` are TDD-tested against `PlayedGame[]`. Panel UI is server-rendered cards composed of shared primitives (`Card`, `PanelHeader`, `RankedListRow`, `StatBar`); charts are thin `'use client'` islands using Recharts. URL params (`?range=...&from=...&to=...&page=...`) drive all navigation; `useTransition` dims panels during range / page changes.

**Tech Stack:** Next.js 15 App Router · Prisma 5 · ioredis · Recharts 3.8 · next-intl · Vitest

**Reference spec:** `docs/superpowers/specs/2026-04-23-stats-panels-expansion-design.md`

**Pre-flight:**
- Work directly on `main` branch (user preference — no PRs, no worktrees).
- Coolify auto-deploys on push; defer pushing until Task 12 gates it.
- Pre-existing test failures (14) in `games-actions`, `players-actions`, `leagues-actions`, etc. are NOT introduced by this work; expected baseline.

---

## File Structure

**New — shared UI primitives (`src/components/stats/`):**
- `Card.tsx` — panel shell
- `PanelHeader.tsx` — title + optional subtitle
- `RankedListRow.tsx` — rank-numbered row used by ranked panels
- `StatBar.tsx` — label + value + proportional bar (animated)
- `PaginatedGamesTable.tsx` — table + prev/next, `variant: 'compact' | 'verbose'`
- `DateFilter.tsx` — client, preset pills + custom range
- `StatsSkeleton.tsx` — skeleton scaffold matching panel shapes
- `AnimatedNumber.tsx` — client, count-up on mount
- `MissionChart.tsx` — client Recharts horizontal bar
- `WinTrendChart.tsx` — client Recharts line chart
- `GamesFrequencyChart.tsx` — client Recharts vertical bar
- `HeadToHeadGrid.tsx` — N×N grid with mobile fallback
- `TransitionDimmer.tsx` — client wrapper, reads `useTransition` pending
- `stats.css` — shared keyframes + classes

**New — stats aggregation library (`src/lib/stats/`):**
- `types.ts` — `StatsScope`, `DateFilter`, `StatsBundle`, `GameRow`, `GamesPage`, `RankingEntry`, etc.
- `dateRange.ts` — `parseRange`, `rangeToWhere`, `cacheSuffix`
- `ranking.ts` — `computeRanking`
- `topGames.ts` — `computeTopGames`
- `playDays.ts` — `computePlayDays`
- `leagues.ts` — `computeLeagues`
- `missions.ts` — `computeMissionStats`
- `gamesFrequency.ts` — `computeGamesFrequency`
- `headToHead.ts` — `computeHeadToHead`
- `streaks.ts` — `computeStreaks`
- `recentForm.ts` — `computeRecentForm`
- `scoreRecords.ts` — `computeScoreRecords`
- `winTrend.ts` — `computeWinTrend`
- `loadStats.ts` — orchestrator (queries DB, computes bundle, handles Redis cache, invalidation)
- `loadGames.ts` — paginated games query
- `invalidateStatsCache.ts` — single invalidation helper called from mutating actions

**Modified:**
- `src/app/app/dashboard/page.tsx` — switch to `loadStats({ kind: 'user' })` + `loadGames` + URL search-param plumbing
- `src/app/app/dashboard/DashboardClient.tsx` — compose panels from primitives; add Missions + GamesFrequency panels
- `src/app/app/leagues/[id]/page.tsx` — parallel loads + delegate to new client
- `src/app/app/leagues/[id]/actions.ts` — replace 8 existing `redis.del('cache:dashboard:${userId}')` calls with `invalidateStatsCache` helper
- `messages/nl/app.json` + `messages/en/app.json` — add `app.stats.*` namespace
- `docs/superpowers/plans/INDEX.md` — mark phase done when complete

**Created:**
- `src/app/app/dashboard/loading.tsx` — skeleton route
- `src/app/app/leagues/[id]/loading.tsx` — skeleton route
- `src/app/app/leagues/[id]/LeagueStatsClient.tsx` — 9-panel composition

**Test files (TDD):**
- `src/lib/stats/dateRange.test.ts`
- `src/lib/stats/ranking.test.ts`
- `src/lib/stats/topGames.test.ts`
- `src/lib/stats/playDays.test.ts`
- `src/lib/stats/leagues.test.ts`
- `src/lib/stats/missions.test.ts`
- `src/lib/stats/gamesFrequency.test.ts`
- `src/lib/stats/headToHead.test.ts`
- `src/lib/stats/streaks.test.ts`
- `src/lib/stats/recentForm.test.ts`
- `src/lib/stats/scoreRecords.test.ts`
- `src/lib/stats/winTrend.test.ts`

---

## Task 1: Extract shared UI primitives, refactor dashboard (invisible)

**Files:**
- Create: `src/components/stats/Card.tsx`
- Create: `src/components/stats/PanelHeader.tsx`
- Create: `src/components/stats/RankedListRow.tsx`
- Create: `src/components/stats/StatBar.tsx`
- Modify: `src/app/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `Card.tsx`**

```tsx
import type { ReactNode, CSSProperties } from 'react'

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: '#fefcf8',
        border: '1px solid #c5b89f',
        borderRadius: 16,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create `PanelHeader.tsx`**

```tsx
export function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        padding: '14px 18px',
        borderBottom: '1px solid #ede5d8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14', fontFamily: 'var(--font-headline)' }}>
        {title}
      </span>
      {subtitle && <span style={{ fontSize: 11, color: '#6b5e4a' }}>{subtitle}</span>}
    </div>
  )
}
```

- [ ] **Step 3: Create `RankedListRow.tsx`**

```tsx
import type { ReactNode } from 'react'

export function RankedListRow({
  rank,
  isLast,
  highlighted,
  children,
}: {
  rank: number
  isLast: boolean
  highlighted?: boolean
  children: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: !isLast ? '1px solid #f2ece3' : undefined,
        ...(highlighted
          ? { background: 'rgba(245,166,35,0.07)', margin: '0 -18px', padding: '8px 18px' }
          : {}),
      }}
    >
      <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: rank <= 3 ? '#f5a623' : '#9a8c7a', flexShrink: 0 }}>
        {rank}
      </span>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Create `StatBar.tsx`**

```tsx
export function StatBar({
  label,
  value,
  ratio,
  highlighted,
  dimmed,
  trailingLabel,
}: {
  label: string
  value: string
  ratio: number       // 0..1
  highlighted?: boolean
  dimmed?: boolean
  trailingLabel?: string
}) {
  const barColor = highlighted ? '#f5a623' : dimmed ? '#dbd0bc' : '#c5b89f'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: highlighted ? 700 : 400, color: dimmed ? '#9a8c7a' : '#1e1a14' }}>
          {label}
          {trailingLabel && <span>{trailingLabel}</span>}
        </span>
        <span style={{ fontSize: 12, color: dimmed ? '#9a8c7a' : '#6b5e4a' }}>{value}</span>
      </div>
      <div style={{ background: '#ede5d8', borderRadius: 4, height: 7 }}>
        <div
          className="stats-bar"
          style={
            {
              background: barColor,
              borderRadius: 4,
              height: 7,
              ['--stats-bar-target' as string]: `${Math.round(ratio * 100)}%`,
              width: 'var(--stats-bar-target)',
              minWidth: ratio > 0 ? 4 : 0,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Rewrite `DashboardClient.tsx` to use primitives**

Replace `RankingPanel`, `TopGamesPanel`, `PlayDaysPanel`, `LeaguesPanel` implementations — keep inputs/outputs identical. Delete the local `card`, `cardHeader`, `cardTitle`, `labelStyle` constants.

```tsx
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { Card } from '@/components/stats/Card'
import { PanelHeader } from '@/components/stats/PanelHeader'
import { RankedListRow } from '@/components/stats/RankedListRow'
import { StatBar } from '@/components/stats/StatBar'
import type { DashboardStats, GamesPage } from './page'

function RankingPanel({ ranking }: { ranking: DashboardStats['ranking'] }) {
  return (
    <Card>
      <PanelHeader title="🏆 Ranking" subtitle="alle leagues" />
      <div style={{ padding: '0 18px' }}>
        {ranking.map((p, i) => (
          <RankedListRow key={p.name} rank={i + 1} isLast={i === ranking.length - 1} highlighted={p.isCurrentUser}>
            <Avatar seed={p.avatarSeed} name={p.name} size={24} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: p.isCurrentUser ? 700 : 400, color: '#1e1a14', marginLeft: 8 }}>
              {p.name}
            </span>
            <span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>{p.wins} wins</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14' }}>{p.winRatio}%</span>
          </RankedListRow>
        ))}
        {ranking.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>}
      </div>
    </Card>
  )
}

function TopGamesPanel({ topGames }: { topGames: DashboardStats['topGames'] }) {
  return (
    <Card>
      <PanelHeader title="🎲 Top spellen" subtitle="meest gespeeld" />
      <div style={{ padding: '0 18px' }}>
        {topGames.map((g, i) => (
          <RankedListRow key={g.name} rank={i + 1} isLast={i === topGames.length - 1}>
            <span style={{ flex: 1, fontSize: 13, color: '#1e1a14' }}>{g.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14', marginRight: 10 }}>{g.count}×</span>
            <span style={{ fontSize: 12, color: '#6b5e4a' }}>
              {g.userWinRatio !== null ? `${g.userWinRatio}% wr` : '—'}
            </span>
          </RankedListRow>
        ))}
        {topGames.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>}
      </div>
    </Card>
  )
}

function PlayDaysPanel({ playDays }: { playDays: DashboardStats['playDays'] }) {
  const max = Math.max(...playDays.map(d => d.count), 1)
  return (
    <Card>
      <PanelHeader title="📅 Speeldagen" />
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {playDays.map((d, i) => (
          <StatBar
            key={d.day}
            label={d.label}
            trailingLabel={i === 0 && d.count > 0 ? ' 🔥' : ''}
            value={`${d.count} sessies`}
            ratio={d.count / max}
            highlighted={i === 0 && d.count > 0}
            dimmed={d.count === 0}
          />
        ))}
      </div>
    </Card>
  )
}

function LeaguesPanel({ leagues }: { leagues: DashboardStats['leagues'] }) {
  function recency(iso: string | null): string {
    if (!iso) return 'nooit gespeeld'
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
    if (days === 0) return 'vandaag'
    if (days === 1) return 'gisteren'
    if (days < 7) return `${days} dagen geleden`
    if (days < 14) return '1 week geleden'
    if (days < 31) return `${Math.floor(days / 7)} weken geleden`
    return `${Math.floor(days / 30)} maanden geleden`
  }

  return (
    <Card>
      <PanelHeader title="🏅 Leagues" subtitle="meest actief" />
      <div style={{ padding: '0 18px' }}>
        {leagues.map((l, i) => (
          <div
            key={l.id}
            style={{
              padding: '11px 0',
              borderBottom: i < leagues.length - 1 ? '1px solid #f2ece3' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400, color: '#1e1a14' }}>{l.name}</div>
                <div style={{ fontSize: 12, color: '#6b5e4a', marginTop: 1 }}>
                  {l.playerCount} speler{l.playerCount !== 1 ? 's' : ''} · {recency(l.lastPlayedAt)}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: l.sessionCount === 0 ? '#9a8c7a' : '#1e1a14' }}>
                {l.sessionCount}×
              </span>
            </div>
          </div>
        ))}
        {leagues.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen leagues aangemaakt.</p>}
      </div>
    </Card>
  )
}

// GamesTable + default export stay as-is; they move in Task 2.
```

Keep `GamesTable` and `DashboardClient` default export unchanged for this task.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "components/stats|dashboard/DashboardClient"
```

Expected: no output.

- [ ] **Step 7: Manual smoke-render**

```bash
npx next build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/stats/Card.tsx src/components/stats/PanelHeader.tsx src/components/stats/RankedListRow.tsx src/components/stats/StatBar.tsx src/app/app/dashboard/DashboardClient.tsx
git commit -m "refactor(stats): extract Card/PanelHeader/RankedListRow/StatBar; dashboard uses primitives"
```

---

## Task 2: Extract `PaginatedGamesTable` (compact variant)

**Files:**
- Create: `src/components/stats/PaginatedGamesTable.tsx`
- Modify: `src/app/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `PaginatedGamesTable.tsx` (compact variant only)**

```tsx
import Link from 'next/link'

export type CompactGameRow = {
  id: string
  gameName: string
  leagueName: string
  playedAt: string
  playerNames: string[]
  userWon: boolean | null
}

export type VerboseGameRow = CompactGameRow & {
  scores: { playerName: string; score: number }[]
  notes: string | null
  shareToken: string | null
}

export type GamesPage<T> = {
  games: T[]
  total: number
  page: number
  totalPages: number
}

type Props =
  | { variant: 'compact'; page: GamesPage<CompactGameRow>; buildHref: (p: number) => string }
  | { variant: 'verbose'; page: GamesPage<VerboseGameRow>; buildHref: (p: number) => string; renderRowActions?: (row: VerboseGameRow) => React.ReactNode }

export function PaginatedGamesTable(props: Props) {
  const { page: gamesPage, buildHref, variant } = props
  const { games, page, totalPages, total } = gamesPage

  return (
    <div style={{ background: '#fefcf8', border: '1px solid #c5b89f', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #ede5d8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14', fontFamily: 'var(--font-headline)' }}>
          Gespeelde partijen
        </span>
        <span style={{ fontSize: 11, color: '#6b5e4a' }}>{total} totaal · pagina {page} van {totalPages}</span>
      </div>

      {variant === 'compact' ? <CompactHeader /> : null}

      {games.map((g, i) => variant === 'compact'
        ? <CompactRow key={g.id} row={g as CompactGameRow} isLast={i === games.length - 1} />
        : <VerboseRow key={g.id} row={g as VerboseGameRow} isLast={i === games.length - 1} renderActions={(props as Extract<Props, { variant: 'verbose' }>).renderRowActions} />
      )}

      {games.length === 0 && (
        <p style={{ fontSize: 13, color: '#9a8c7a', padding: '20px', textAlign: 'center' }}>Nog geen partijen gespeeld.</p>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  )
}

function CompactHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 90px', padding: '7px 20px', background: '#f2ece3' }}>
      {['Spel · League', 'Datum', 'Spelers', 'Uitslag'].map(h => (
        <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b5e4a' }}>{h}</span>
      ))}
    </div>
  )
}

function CompactRow({ row, isLast }: { row: CompactGameRow; isLast: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 120px 140px 90px',
        padding: '11px 20px',
        borderBottom: !isLast ? '1px solid #f2ece3' : undefined,
        background: row.userWon === true ? 'rgba(245,166,35,0.04)' : undefined,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1a14' }}>{row.gameName}</div>
        <div style={{ fontSize: 11, color: '#6b5e4a' }}>{row.leagueName}</div>
      </div>
      <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>
        {new Date(row.playedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>{row.playerNames.join(', ')}</div>
      <div style={{ paddingTop: 1 }}>
        {row.userWon === true && <Badge text="Gewonnen" tone="win" />}
        {row.userWon === false && <Badge text="Verloren" tone="lose" />}
      </div>
    </div>
  )
}

function VerboseRow({
  row,
  isLast,
  renderActions,
}: {
  row: VerboseGameRow
  isLast: boolean
  renderActions?: (row: VerboseGameRow) => React.ReactNode
}) {
  const d = new Date(row.playedAt)
  const time = d.getHours() !== 0 || d.getMinutes() !== 0 ? ` · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''
  const winner = row.scores[0]?.playerName
  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: !isLast ? '1px solid #f2ece3' : undefined,
        background: row.userWon === true ? 'rgba(245,166,35,0.04)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#6b5e4a', flex: 1 }}>
          {d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}{time}
        </span>
        {winner && (
          <span style={{ fontSize: 12, color: '#1e1a14' }}>
            <span style={{ color: '#6b5e4a' }}>Winnaar:</span> <strong>{winner}</strong>
          </span>
        )}
        {row.notes && <span title={row.notes} aria-label={row.notes} style={{ fontSize: 12, color: '#6b5e4a' }}>📝</span>}
        {renderActions?.(row)}
      </div>
      <div style={{ fontSize: 12, color: '#4a3f2f' }}>
        {row.scores.map(s => `${s.playerName} ${s.score}`).join(' · ')}
      </div>
    </div>
  )
}

function Badge({ text, tone }: { text: string; tone: 'win' | 'lose' }) {
  const style = tone === 'win'
    ? { background: '#fff3d4', color: '#c27f0a' }
    : { background: '#f2ece3', color: '#6b5e4a' }
  return (
    <span style={{ ...style, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{text}</span>
  )
}

function Pagination({ page, totalPages, buildHref }: { page: number; totalPages: number; buildHref: (p: number) => string }) {
  const base = { padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', fontSize: 12, textDecoration: 'none' } as const
  return (
    <div style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #ede5d8', background: '#f2ece3' }}>
      <span style={{ fontSize: 12, color: '#6b5e4a' }}>Pagina {page} van {totalPages} · 25 per pagina</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {page > 1 ? (
          <Link href={buildHref(page - 1)} style={{ ...base, color: '#1e1a14' }}>← Vorige</Link>
        ) : (
          <span style={{ ...base, color: '#9a8c7a', opacity: 0.4 }}>← Vorige</span>
        )}
        {page < totalPages ? (
          <Link href={buildHref(page + 1)} style={{ ...base, color: '#c27f0a', borderColor: '#f5a623', background: '#fff3d4', fontWeight: 600 }}>Volgende →</Link>
        ) : (
          <span style={{ ...base, color: '#9a8c7a', opacity: 0.4 }}>Volgende →</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `DashboardClient.tsx` to use `PaginatedGamesTable`**

Delete the local `GamesTable` function in `DashboardClient.tsx`. Replace its usage at the bottom of `DashboardClient` with:

```tsx
import { PaginatedGamesTable } from '@/components/stats/PaginatedGamesTable'

// inside DashboardClient return JSX, replacing <GamesTable gamesPage={gamesPage} />:
<PaginatedGamesTable
  variant="compact"
  page={gamesPage}
  buildHref={(p) => `?page=${p}`}
/>
```

The `GamesPage` and `GameRow` types remain exported from `page.tsx` (they match `GamesPage<CompactGameRow>` / `CompactGameRow` structurally).

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "components/stats|dashboard/"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/PaginatedGamesTable.tsx src/app/app/dashboard/DashboardClient.tsx
git commit -m "refactor(stats): extract PaginatedGamesTable; dashboard uses compact variant"
```

---

## Task 3: Stats library foundation + date range (TDD)

**Files:**
- Create: `src/lib/stats/types.ts`
- Create: `src/lib/stats/dateRange.ts`
- Create: `src/lib/stats/ranking.ts`
- Create: `src/lib/stats/topGames.ts`
- Create: `src/lib/stats/playDays.ts`
- Create: `src/lib/stats/leagues.ts`
- Test: `src/lib/stats/dateRange.test.ts`
- Test: `src/lib/stats/ranking.test.ts`
- Test: `src/lib/stats/topGames.test.ts`
- Test: `src/lib/stats/playDays.test.ts`
- Test: `src/lib/stats/leagues.test.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
export type StatsScope =
  | { kind: 'user'; userId: string }
  | { kind: 'league'; leagueId: string; viewerId: string }

export type Range = 'week' | 'month' | 'year' | 'all' | 'custom'

export type DateFilter = {
  range: Range
  from: Date | null    // null means no lower bound
  to: Date | null      // null means no upper bound
}

export type RankingEntry = {
  playerId: string
  name: string
  avatarSeed: string
  wins: number
  gamesPlayed: number
  winRatio: number
  isCurrentUser: boolean
}

export type TopGame = {
  name: string
  count: number
  userWinRatio: number | null
}

export type PlayDay = {
  day: number
  label: string
  count: number
}

export type LeagueStat = {
  id: string
  name: string
  playerCount: number
  sessionCount: number
  lastPlayedAt: string | null
}

export type MissionStat = {
  name: string
  count: number
}

export type FrequencyBucket = {
  label: string
  startISO: string
  count: number
}

export type HeadToHeadMatrix = {
  players: { id: string; name: string; avatarSeed: string }[]
  cells: number[][]   // cells[i][j] = games where players[i] finished above players[j]
}

export type StreakEntry = {
  playerId: string
  name: string
  avatarSeed: string
  currentStreak: number
  longestStreak: number
}

export type RecentFormRow = {
  playerId: string
  name: string
  avatarSeed: string
  isCurrentUser: boolean
  results: ('W' | 'L')[]  // newest first, max 5
}

export type ScoreRecords = {
  highest: { playerName: string; score: number; playedAt: string } | null
  highestLoss: { playerName: string; score: number; playedAt: string } | null
  averageWinner: number | null
}

export type WinTrendSeries = {
  players: { id: string; name: string; color: string }[]
  points: { gameIndex: number; [playerId: string]: number }[]  // cumulative wins per player
}

export type StatsBundle = {
  ranking: RankingEntry[]
  topGames?: TopGame[]
  leagues?: LeagueStat[]
  playDays: PlayDay[]
  missions: MissionStat[] | null
  gamesFrequency: FrequencyBucket[]
  headToHead?: HeadToHeadMatrix
  streaks?: StreakEntry[] | null
  recentForm?: RecentFormRow[] | null
  scoreRecords?: ScoreRecords
  winTrend?: WinTrendSeries | null
}

// Minimal shape of a PlayedGame row passed to aggregators (decoupled from Prisma types)
export type AggregatorGame = {
  id: string
  playedAt: Date
  winningMission: string | null
  notes: string | null
  shareToken: string | null
  league: {
    id: string
    name: string
    gameTemplate: { name: string; missions: string[] }
  }
  scores: {
    playerId: string
    score: number
    player: { id: string; name: string; avatarSeed: string; userId: string | null }
  }[]
}

export type AggregatorMember = {
  playerId: string
  name: string
  avatarSeed: string
  userId: string | null
}
```

- [ ] **Step 2: Write `dateRange.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { parseRange, rangeToWhere, cacheSuffix } from './dateRange'

describe('parseRange', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-23T12:00:00Z')) })
  afterAll(() => { vi.useRealTimers() })

  it('defaults to all when range missing', () => {
    expect(parseRange({})).toEqual({ range: 'all', from: null, to: null })
  })

  it('parses week → ISO week start', () => {
    const f = parseRange({ range: 'week' })
    expect(f.range).toBe('week')
    expect(f.from?.getUTCDay()).toBe(1) // Monday
    expect(f.to).toBeNull()
  })

  it('parses month → first of current month UTC', () => {
    const f = parseRange({ range: 'month' })
    expect(f.range).toBe('month')
    expect(f.from?.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('parses year → Jan 1 UTC', () => {
    const f = parseRange({ range: 'year' })
    expect(f.from?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('parses custom with from+to', () => {
    const f = parseRange({ range: 'custom', from: '2026-01-15', to: '2026-03-01' })
    expect(f.range).toBe('custom')
    expect(f.from?.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(f.to?.toISOString()).toBe('2026-03-01T23:59:59.999Z')
  })

  it('falls back to all on malformed custom', () => {
    expect(parseRange({ range: 'custom', from: 'invalid' })).toEqual({ range: 'all', from: null, to: null })
    expect(parseRange({ range: 'custom' })).toEqual({ range: 'all', from: null, to: null })
  })
})

describe('rangeToWhere', () => {
  it('returns empty for all', () => {
    expect(rangeToWhere({ range: 'all', from: null, to: null })).toEqual({})
  })

  it('returns gte only for week', () => {
    const from = new Date('2026-04-20T00:00:00Z')
    expect(rangeToWhere({ range: 'week', from, to: null })).toEqual({ playedAt: { gte: from } })
  })

  it('returns gte+lte for custom', () => {
    const from = new Date('2026-01-15')
    const to = new Date('2026-03-01')
    expect(rangeToWhere({ range: 'custom', from, to })).toEqual({ playedAt: { gte: from, lte: to } })
  })
})

describe('cacheSuffix', () => {
  it('returns range key for non-custom', () => {
    expect(cacheSuffix({ range: 'week', from: new Date(), to: null })).toBe('week')
    expect(cacheSuffix({ range: 'all', from: null, to: null })).toBe('all')
  })

  it('returns null for custom (cache skip)', () => {
    expect(cacheSuffix({ range: 'custom', from: new Date(), to: new Date() })).toBeNull()
  })
})
```

- [ ] **Step 3: Run failing**

```bash
npx vitest run src/lib/stats/dateRange.test.ts
```

Expected: FAIL with "Cannot find module './dateRange'".

- [ ] **Step 4: Implement `dateRange.ts`**

```ts
import type { DateFilter, Range } from './types'

const VALID_RANGES: Range[] = ['week', 'month', 'year', 'all', 'custom']

function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime())
}

function startOfISOWeekUTC(now: Date): Date {
  const d = new Date(now)
  const day = d.getUTCDay()
  const diff = (day + 6) % 7 // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function startOfMonthUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

function startOfYearUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
}

export function parseRange(searchParams: {
  range?: string
  from?: string
  to?: string
}): DateFilter {
  const raw = searchParams.range
  const range: Range = raw && (VALID_RANGES as string[]).includes(raw) ? (raw as Range) : 'all'
  const now = new Date()

  if (range === 'all') return { range: 'all', from: null, to: null }

  if (range === 'week') return { range: 'week', from: startOfISOWeekUTC(now), to: null }
  if (range === 'month') return { range: 'month', from: startOfMonthUTC(now), to: null }
  if (range === 'year') return { range: 'year', from: startOfYearUTC(now), to: null }

  // custom
  if (!searchParams.from || !searchParams.to) {
    return { range: 'all', from: null, to: null }
  }
  const from = new Date(`${searchParams.from}T00:00:00.000Z`)
  const to = new Date(`${searchParams.to}T23:59:59.999Z`)
  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return { range: 'all', from: null, to: null }
  }
  return { range: 'custom', from, to }
}

export function rangeToWhere(filter: DateFilter): { playedAt?: { gte?: Date; lte?: Date } } {
  if (!filter.from && !filter.to) return {}
  const w: { gte?: Date; lte?: Date } = {}
  if (filter.from) w.gte = filter.from
  if (filter.to) w.lte = filter.to
  return { playedAt: w }
}

export function cacheSuffix(filter: DateFilter): string | null {
  if (filter.range === 'custom') return null
  return filter.range
}
```

- [ ] **Step 5: Run passing**

```bash
npx vitest run src/lib/stats/dateRange.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write `ranking.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeRanking } from './ranking'
import type { AggregatorGame } from './types'

function game(id: string, scores: { playerId: string; name: string; score: number; userId?: string | null }[]): AggregatorGame {
  return {
    id, playedAt: new Date(), winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'League', gameTemplate: { name: 'G', missions: [] } },
    scores: scores
      .slice()
      .sort((a, b) => b.score - a.score)
      .map(s => ({ playerId: s.playerId, score: s.score, player: { id: s.playerId, name: s.name, avatarSeed: s.playerId, userId: s.userId ?? null } })),
  }
}

describe('computeRanking', () => {
  it('returns empty array for no games', () => {
    expect(computeRanking([], undefined)).toEqual([])
  })

  it('counts wins and games played', () => {
    const games = [
      game('g1', [{ playerId: 'p1', name: 'Alice', score: 10 }, { playerId: 'p2', name: 'Bob', score: 8 }]),
      game('g2', [{ playerId: 'p1', name: 'Alice', score: 5 }, { playerId: 'p2', name: 'Bob', score: 12 }]),
    ]
    const ranking = computeRanking(games, undefined)
    expect(ranking).toHaveLength(2)
    expect(ranking[0]).toMatchObject({ name: 'Alice', wins: 1, gamesPlayed: 2, winRatio: 50 })
    expect(ranking[1]).toMatchObject({ name: 'Bob', wins: 1, gamesPlayed: 2, winRatio: 50 })
  })

  it('marks isCurrentUser when viewerId matches player.userId', () => {
    const games = [game('g1', [{ playerId: 'p1', name: 'Alice', score: 10, userId: 'u1' }])]
    const r = computeRanking(games, 'u1')
    expect(r[0].isCurrentUser).toBe(true)
  })

  it('sorts by wins desc, caps to 10', () => {
    const games = Array.from({ length: 12 }, (_, i) =>
      game(`g${i}`, [{ playerId: `p${i}`, name: `P${i}`, score: 10 }])
    )
    const r = computeRanking(games, undefined)
    expect(r).toHaveLength(10)
    expect(r[0].wins).toBe(1)
  })
})
```

- [ ] **Step 7: Run failing, implement, run passing**

```bash
npx vitest run src/lib/stats/ranking.test.ts
```

Expected first run: FAIL (module missing).

Create `src/lib/stats/ranking.ts`:

```ts
import type { AggregatorGame, RankingEntry } from './types'

export function computeRanking(games: AggregatorGame[], viewerId: string | undefined): RankingEntry[] {
  const byPlayer: Record<string, {
    playerId: string; name: string; avatarSeed: string; userId: string | null
    wins: number; gamesPlayed: number
  }> = {}

  for (const g of games) {
    for (const s of g.scores) {
      if (!byPlayer[s.playerId]) {
        byPlayer[s.playerId] = {
          playerId: s.playerId, name: s.player.name, avatarSeed: s.player.avatarSeed, userId: s.player.userId,
          wins: 0, gamesPlayed: 0,
        }
      }
      byPlayer[s.playerId].gamesPlayed++
    }
    const winner = g.scores[0]
    if (winner && byPlayer[winner.playerId]) byPlayer[winner.playerId].wins++
  }

  return Object.values(byPlayer)
    .map(p => ({
      playerId: p.playerId,
      name: p.name,
      avatarSeed: p.avatarSeed,
      wins: p.wins,
      gamesPlayed: p.gamesPlayed,
      winRatio: p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0,
      isCurrentUser: viewerId != null && p.userId === viewerId,
    }))
    .sort((a, b) => b.wins - a.wins || b.winRatio - a.winRatio)
    .slice(0, 10)
}
```

Run: `npx vitest run src/lib/stats/ranking.test.ts`. Expected: PASS.

- [ ] **Step 8: Write + implement `topGames.ts` + test**

Test (`topGames.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { computeTopGames } from './topGames'
import type { AggregatorGame } from './types'

function game(templateName: string, scores: { playerId: string; name: string; score: number; userId?: string | null }[]): AggregatorGame {
  return {
    id: Math.random().toString(), playedAt: new Date(), winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: templateName, missions: [] } },
    scores: scores.slice().sort((a, b) => b.score - a.score).map(s => ({
      playerId: s.playerId, score: s.score,
      player: { id: s.playerId, name: s.name, avatarSeed: s.playerId, userId: s.userId ?? null },
    })),
  }
}

describe('computeTopGames', () => {
  it('counts plays per template and user winRatio', () => {
    const games = [
      game('Catan', [{ playerId: 'p1', name: 'A', score: 10, userId: 'u1' }, { playerId: 'p2', name: 'B', score: 5 }]),
      game('Catan', [{ playerId: 'p1', name: 'A', score: 3, userId: 'u1' }, { playerId: 'p2', name: 'B', score: 9 }]),
      game('Ticket', [{ playerId: 'p1', name: 'A', score: 40, userId: 'u1' }]),
    ]
    const top = computeTopGames(games, 'u1')
    expect(top[0]).toEqual({ name: 'Catan', count: 2, userWinRatio: 50 })
    expect(top[1]).toEqual({ name: 'Ticket', count: 1, userWinRatio: 100 })
  })

  it('userWinRatio null when user has no scores in template', () => {
    const games = [game('Catan', [{ playerId: 'p2', name: 'B', score: 10 }])]
    expect(computeTopGames(games, 'u1')[0].userWinRatio).toBeNull()
  })
})
```

Implementation (`topGames.ts`):

```ts
import type { AggregatorGame, TopGame } from './types'

export function computeTopGames(games: AggregatorGame[], viewerId: string | undefined): TopGame[] {
  const byTemplate: Record<string, { count: number; userWins: number; userGames: number }> = {}

  for (const g of games) {
    const name = g.league.gameTemplate.name
    if (!byTemplate[name]) byTemplate[name] = { count: 0, userWins: 0, userGames: 0 }
    byTemplate[name].count++
    const winner = g.scores[0]
    for (const s of g.scores) {
      if (viewerId != null && s.player.userId === viewerId) {
        byTemplate[name].userGames++
        if (winner && s.playerId === winner.playerId) byTemplate[name].userWins++
      }
    }
  }

  return Object.entries(byTemplate)
    .map(([name, t]) => ({
      name,
      count: t.count,
      userWinRatio: t.userGames > 0 ? Math.round((t.userWins / t.userGames) * 100) : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}
```

Run: `npx vitest run src/lib/stats/topGames.test.ts`. Expected: PASS.

- [ ] **Step 9: Write + implement `playDays.ts` + test**

Test (`playDays.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { computePlayDays } from './playDays'
import type { AggregatorGame } from './types'

function g(playedAt: string): AggregatorGame {
  return {
    id: playedAt, playedAt: new Date(playedAt), winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: [],
  }
}

describe('computePlayDays', () => {
  it('returns 7 entries, sorted by count desc', () => {
    const games = [g('2026-04-20T10:00:00Z'), g('2026-04-20T11:00:00Z'), g('2026-04-22T10:00:00Z')]
    const days = computePlayDays(games, 'nl')
    expect(days).toHaveLength(7)
    expect(days[0].count).toBeGreaterThanOrEqual(days[1].count)
    expect(days[0].count).toBe(2)
  })

  it('returns all zeros when no games', () => {
    const days = computePlayDays([], 'nl')
    expect(days.every(d => d.count === 0)).toBe(true)
    expect(days).toHaveLength(7)
  })
})
```

Implementation (`playDays.ts`):

```ts
import type { AggregatorGame, PlayDay } from './types'

const LOCALE_MAP: Record<string, string> = { nl: 'nl-NL', en: 'en-GB' }

export function computePlayDays(games: AggregatorGame[], locale: 'nl' | 'en'): PlayDay[] {
  const counts = new Array(7).fill(0) as number[]
  for (const g of games) counts[new Date(g.playedAt).getDay()]++

  const fmt = new Intl.DateTimeFormat(LOCALE_MAP[locale] ?? 'en-GB', { weekday: 'long' })
  // Reference dates: 2026-04-19 is a Sunday (JS day 0).
  const reference = new Date('2026-04-19T12:00:00Z')

  return counts
    .map((count, day) => {
      const labelDate = new Date(reference)
      labelDate.setUTCDate(reference.getUTCDate() + day)
      const label = fmt.format(labelDate)
      return { day, label: label.charAt(0).toUpperCase() + label.slice(1), count }
    })
    .sort((a, b) => b.count - a.count)
}
```

Run: `npx vitest run src/lib/stats/playDays.test.ts`. Expected: PASS.

- [ ] **Step 10: Write + implement `leagues.ts` + test**

Test (`leagues.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { computeLeagues } from './leagues'
import type { AggregatorGame } from './types'

function g(leagueId: string, playedAt: string): AggregatorGame {
  return {
    id: `${leagueId}-${playedAt}`, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: leagueId, name: `League ${leagueId}`, gameTemplate: { name: 'G', missions: [] } },
    scores: [],
  }
}

describe('computeLeagues', () => {
  it('joins league list with played-games aggregation', () => {
    const allLeagues = [
      { id: 'l1', name: 'L1', playerCount: 3 },
      { id: 'l2', name: 'L2', playerCount: 5 },
    ]
    const games = [
      g('l1', '2026-04-20T10:00:00Z'),
      g('l1', '2026-04-21T10:00:00Z'),
    ]
    const result = computeLeagues(allLeagues, games)
    expect(result[0]).toMatchObject({ id: 'l1', sessionCount: 2 })
    expect(result[0].lastPlayedAt).toBe('2026-04-21T10:00:00.000Z')
    expect(result[1]).toMatchObject({ id: 'l2', sessionCount: 0, lastPlayedAt: null })
  })
})
```

Implementation (`leagues.ts`):

```ts
import type { AggregatorGame, LeagueStat } from './types'

export function computeLeagues(
  allLeagues: { id: string; name: string; playerCount: number }[],
  games: AggregatorGame[],
): LeagueStat[] {
  const counts: Record<string, number> = {}
  const last: Record<string, string> = {}

  for (const g of games) {
    counts[g.league.id] = (counts[g.league.id] ?? 0) + 1
    const iso = g.playedAt.toISOString()
    if (!last[g.league.id] || iso > last[g.league.id]) last[g.league.id] = iso
  }

  return allLeagues
    .map(l => ({
      id: l.id,
      name: l.name,
      playerCount: l.playerCount,
      sessionCount: counts[l.id] ?? 0,
      lastPlayedAt: last[l.id] ?? null,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
}
```

Run: `npx vitest run src/lib/stats/leagues.test.ts`. Expected: PASS.

- [ ] **Step 11: Run full new-tests suite**

```bash
npx vitest run src/lib/stats/
```

Expected: all new tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/lib/stats/
git commit -m "feat(stats): types, dateRange, ranking, topGames, playDays, leagues aggregators (TDD)"
```

---

## Task 4: `loadStats` + `loadGames` + refactor dashboard `page.tsx`

**Files:**
- Create: `src/lib/stats/loadStats.ts`
- Create: `src/lib/stats/loadGames.ts`
- Create: `src/lib/stats/invalidateStatsCache.ts`
- Modify: `src/app/app/dashboard/page.tsx`

- [ ] **Step 1: Create `invalidateStatsCache.ts`**

```ts
import { redis } from '@/lib/redis'

const RANGES = ['week', 'month', 'year', 'all'] as const

export async function invalidateStatsCache(params: {
  userIds: string[]
  leagueIds?: string[]
}): Promise<void> {
  const keys: string[] = []
  for (const uid of params.userIds) {
    for (const r of RANGES) keys.push(`cache:stats:user:${uid}:${r}`)
    // Backwards-compat: delete the legacy dashboard key too
    keys.push(`cache:dashboard:stats:${uid}`)
    keys.push(`cache:dashboard:${uid}`)
  }
  for (const lid of params.leagueIds ?? []) {
    for (const r of RANGES) keys.push(`cache:stats:league:${lid}:${r}`)
  }
  if (keys.length > 0) await redis.del(...keys)
}
```

- [ ] **Step 2: Create `loadStats.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import type { StatsScope, DateFilter, StatsBundle, AggregatorGame } from './types'
import { rangeToWhere, cacheSuffix } from './dateRange'
import { computeRanking } from './ranking'
import { computeTopGames } from './topGames'
import { computePlayDays } from './playDays'
import { computeLeagues } from './leagues'
import { computeMissionStats } from './missions'
import { computeGamesFrequency } from './gamesFrequency'
import { computeHeadToHead } from './headToHead'
import { computeStreaks } from './streaks'
import { computeRecentForm } from './recentForm'
import { computeScoreRecords } from './scoreRecords'
import { computeWinTrend } from './winTrend'

function cacheKey(scope: StatsScope, filter: DateFilter): string | null {
  const suffix = cacheSuffix(filter)
  if (suffix === null) return null
  if (scope.kind === 'user') return `cache:stats:user:${scope.userId}:${suffix}`
  return `cache:stats:league:${scope.leagueId}:${suffix}`
}

async function fetchGames(scope: StatsScope, filter: DateFilter): Promise<AggregatorGame[]> {
  const dateWhere = rangeToWhere(filter)
  const where = scope.kind === 'user'
    ? { league: { ownerId: scope.userId }, status: 'approved', ...dateWhere }
    : { leagueId: scope.leagueId, status: 'approved', ...dateWhere }

  const rows = await prisma.playedGame.findMany({
    where: where as never,
    include: {
      league: {
        select: {
          id: true, name: true,
          gameTemplate: { select: { name: true, missions: true } },
        },
      },
      scores: {
        include: { player: { select: { id: true, name: true, avatarSeed: true, userId: true } } },
        orderBy: { score: 'desc' },
      },
    },
    orderBy: { playedAt: 'asc' },
  })

  return rows.map(r => ({
    id: r.id,
    playedAt: r.playedAt,
    winningMission: r.winningMission ?? null,
    notes: r.notes ?? null,
    shareToken: r.shareToken ?? null,
    league: {
      id: r.league.id,
      name: r.league.name,
      gameTemplate: { name: r.league.gameTemplate.name, missions: r.league.gameTemplate.missions },
    },
    scores: r.scores.map(s => ({
      playerId: s.playerId,
      score: s.score,
      player: {
        id: s.player.id,
        name: s.player.name,
        avatarSeed: s.player.avatarSeed,
        userId: s.player.userId,
      },
    })),
  }))
}

export async function loadStats(
  scope: StatsScope,
  filter: DateFilter,
  locale: 'nl' | 'en' = 'nl',
): Promise<StatsBundle> {
  const key = cacheKey(scope, filter)
  if (key) {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as StatsBundle
  }

  const games = await fetchGames(scope, filter)
  const viewerId = scope.kind === 'user' ? scope.userId : scope.viewerId

  let bundle: StatsBundle
  if (scope.kind === 'user') {
    const allLeagues = await prisma.league.findMany({
      where: { ownerId: scope.userId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    })
    bundle = {
      ranking: computeRanking(games, viewerId),
      topGames: computeTopGames(games, viewerId),
      leagues: computeLeagues(
        allLeagues.map(l => ({ id: l.id, name: l.name, playerCount: l._count.members })),
        games,
      ),
      playDays: computePlayDays(games, locale),
      missions: computeMissionStats(games),
      gamesFrequency: computeGamesFrequency(games, filter),
    }
  } else {
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: scope.leagueId },
      include: { player: { select: { id: true, name: true, avatarSeed: true, userId: true } } },
    })
    const memberSummaries = members.map(m => ({
      playerId: m.player.id, name: m.player.name, avatarSeed: m.player.avatarSeed, userId: m.player.userId,
    }))
    const hideHeadToHead = members.length > 8
    bundle = {
      ranking: computeRanking(games, viewerId),
      playDays: computePlayDays(games, locale),
      missions: computeMissionStats(games),
      gamesFrequency: computeGamesFrequency(games, filter),
      headToHead: hideHeadToHead ? undefined : computeHeadToHead(games, memberSummaries),
      streaks: games.length >= 3 ? computeStreaks(games, memberSummaries) : null,
      recentForm: games.length >= 3 ? computeRecentForm(games, memberSummaries, viewerId) : null,
      scoreRecords: computeScoreRecords(games),
      winTrend: games.length >= 3 ? computeWinTrend(games, memberSummaries) : null,
    }
  }

  if (key) await redis.setex(key, 300, JSON.stringify(bundle))
  return bundle
}
```

- [ ] **Step 3: Create `loadGames.ts`**

```ts
import { prisma } from '@/lib/prisma'
import type { StatsScope, DateFilter } from './types'
import { rangeToWhere } from './dateRange'
import type { CompactGameRow, VerboseGameRow, GamesPage } from '@/components/stats/PaginatedGamesTable'

export async function loadGames(
  scope: StatsScope,
  filter: DateFilter,
  page: number,
  perPage: number,
  variant: 'compact',
): Promise<GamesPage<CompactGameRow>>
export async function loadGames(
  scope: StatsScope,
  filter: DateFilter,
  page: number,
  perPage: number,
  variant: 'verbose',
): Promise<GamesPage<VerboseGameRow>>
export async function loadGames(
  scope: StatsScope,
  filter: DateFilter,
  page: number,
  perPage: number,
  variant: 'compact' | 'verbose',
): Promise<GamesPage<CompactGameRow> | GamesPage<VerboseGameRow>> {
  const dateWhere = rangeToWhere(filter)
  const where = (scope.kind === 'user'
    ? { league: { ownerId: scope.userId }, status: 'approved' as const, ...dateWhere }
    : { leagueId: scope.leagueId, status: 'approved' as const, ...dateWhere }) as never

  const viewerId = scope.kind === 'user' ? scope.userId : scope.viewerId

  const [userPlayerIds, total, rows] = await Promise.all([
    prisma.player.findMany({ where: { userId: viewerId }, select: { id: true } }).then(ps => new Set(ps.map(p => p.id))),
    prisma.playedGame.count({ where }),
    prisma.playedGame.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { playedAt: 'desc' },
      include: {
        league: { select: { name: true, gameTemplate: { select: { name: true } } } },
        scores: {
          include: { player: { select: { id: true, name: true } } },
          orderBy: { score: 'desc' },
        },
      },
    }),
  ])

  const buildUserWon = (pg: typeof rows[number]): boolean | null => {
    const winner = pg.scores[0]
    const userInGame = pg.scores.some(s => userPlayerIds.has(s.playerId))
    if (!userInGame) return null
    return winner != null && userPlayerIds.has(winner.playerId)
  }

  if (variant === 'compact') {
    const games: CompactGameRow[] = rows.map(pg => ({
      id: pg.id,
      gameName: pg.league.gameTemplate.name,
      leagueName: pg.league.name,
      playedAt: pg.playedAt.toISOString(),
      playerNames: pg.scores.map(s => s.player.name),
      userWon: buildUserWon(pg),
    }))
    return { games, total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) }
  }

  const games: VerboseGameRow[] = rows.map(pg => ({
    id: pg.id,
    gameName: pg.league.gameTemplate.name,
    leagueName: pg.league.name,
    playedAt: pg.playedAt.toISOString(),
    playerNames: pg.scores.map(s => s.player.name),
    userWon: buildUserWon(pg),
    scores: pg.scores.map(s => ({ playerName: s.player.name, score: s.score })),
    notes: pg.notes ?? null,
    shareToken: pg.shareToken ?? null,
  }))
  return { games, total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) }
}
```

- [ ] **Step 4: Rewrite `src/app/app/dashboard/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { loadStats } from '@/lib/stats/loadStats'
import { loadGames } from '@/lib/stats/loadGames'
import { parseRange } from '@/lib/stats/dateRange'

type PageProps = {
  searchParams: Promise<{ range?: string; from?: string; to?: string; page?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const sp = await searchParams
  const filter = parseRange(sp)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const locale = (session.user.locale === 'nl' ? 'nl' : 'en') as 'nl' | 'en'

  const scope = { kind: 'user' as const, userId: session.user.id }

  const [stats, gamesPage, user] = await Promise.all([
    loadStats(scope, filter, locale),
    loadGames(scope, filter, page, 25, 'compact'),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true, email: true } }),
  ])

  const displayName = user?.username ?? user?.email?.split('@')[0] ?? ''

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div style={{ marginBottom: 24 }}>
        <h1
          className="font-headline"
          style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14', letterSpacing: '-0.02em' }}
        >
          Goedemiddag, {displayName} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#6b5e4a', marginTop: 2 }}>Hier is je overzicht</p>
      </div>
      <DashboardClient stats={stats} gamesPage={gamesPage} filter={filter} />
    </div>
  )
}
```

Note: this breaks the export of `DashboardStats` / `GamesPage` from `page.tsx`. Update `DashboardClient.tsx` to import from the new library:

```tsx
// top of DashboardClient.tsx
import type { StatsBundle, DateFilter } from '@/lib/stats/types'
import type { CompactGameRow, GamesPage } from '@/components/stats/PaginatedGamesTable'

export default function DashboardClient({
  stats,
  gamesPage,
  filter,
}: {
  stats: StatsBundle
  gamesPage: GamesPage<CompactGameRow>
  filter: DateFilter
}) { ... }
```

Replace every `DashboardStats['ranking']` etc. reference in the file with `StatsBundle['ranking']`. Panels that reference optional props (`stats.topGames`, `stats.leagues`) must narrow via non-null assertions or conditional renders. Since dashboard scope always sets them, cast safely:

```tsx
{stats.topGames && <TopGamesPanel topGames={stats.topGames} />}
{stats.leagues && <LeaguesPanel leagues={stats.leagues} />}
```

Missions and GamesFrequency are computed for dashboard but UI added in Task 8; don't render them yet.

- [ ] **Step 5: Typecheck (note: `missions.ts`, `gamesFrequency.ts`, and all league-only aggregators are imported by loadStats but don't exist yet — create stubs that throw)**

Create stub files so typecheck passes:

```bash
# src/lib/stats/missions.ts
```
```ts
import type { AggregatorGame, MissionStat } from './types'
export function computeMissionStats(_games: AggregatorGame[]): MissionStat[] | null {
  return null
}
```

```bash
# src/lib/stats/gamesFrequency.ts
```
```ts
import type { AggregatorGame, DateFilter, FrequencyBucket } from './types'
export function computeGamesFrequency(_games: AggregatorGame[], _filter: DateFilter): FrequencyBucket[] {
  return []
}
```

```bash
# src/lib/stats/headToHead.ts
```
```ts
import type { AggregatorGame, AggregatorMember, HeadToHeadMatrix } from './types'
export function computeHeadToHead(_games: AggregatorGame[], _members: AggregatorMember[]): HeadToHeadMatrix {
  return { players: [], cells: [] }
}
```

```bash
# src/lib/stats/streaks.ts
```
```ts
import type { AggregatorGame, AggregatorMember, StreakEntry } from './types'
export function computeStreaks(_games: AggregatorGame[], _members: AggregatorMember[]): StreakEntry[] | null {
  return null
}
```

```bash
# src/lib/stats/recentForm.ts
```
```ts
import type { AggregatorGame, AggregatorMember, RecentFormRow } from './types'
export function computeRecentForm(_games: AggregatorGame[], _members: AggregatorMember[], _viewerId: string | undefined): RecentFormRow[] | null {
  return null
}
```

```bash
# src/lib/stats/scoreRecords.ts
```
```ts
import type { AggregatorGame, ScoreRecords } from './types'
export function computeScoreRecords(_games: AggregatorGame[]): ScoreRecords {
  return { highest: null, highestLoss: null, averageWinner: null }
}
```

```bash
# src/lib/stats/winTrend.ts
```
```ts
import type { AggregatorGame, AggregatorMember, WinTrendSeries } from './types'
export function computeWinTrend(_games: AggregatorGame[], _members: AggregatorMember[]): WinTrendSeries | null {
  return null
}
```

Then:

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test" | head -20
```

Expected: no errors in production code.

- [ ] **Step 6: Quick e2e — open `/app/dashboard` locally**

```bash
npm run dev
# visit http://localhost:3000/app/dashboard — should render identically to pre-change
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/stats/ src/app/app/dashboard/page.tsx src/app/app/dashboard/DashboardClient.tsx
git commit -m "feat(stats): loadStats/loadGames orchestrators + invalidateStatsCache; dashboard uses scope abstraction"
```

---

## Task 5: `DateFilter` component + dashboard URL wiring

**Files:**
- Create: `src/components/stats/DateFilter.tsx`
- Create: `src/components/stats/TransitionDimmer.tsx`
- Modify: `src/app/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create `TransitionDimmer.tsx`**

```tsx
'use client'

import { createContext, useContext, useTransition, type ReactNode } from 'react'

type TransitionCtx = {
  isPending: boolean
  startTransition: (cb: () => void) => void
}

const Ctx = createContext<TransitionCtx | null>(null)

export function TransitionProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition()
  return <Ctx.Provider value={{ isPending, startTransition }}>{children}</Ctx.Provider>
}

export function useRouteTransition(): TransitionCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRouteTransition must be inside TransitionProvider')
  return v
}

export function DimmedWhilePending({ children }: { children: ReactNode }) {
  const { isPending } = useRouteTransition()
  return (
    <div
      style={{
        opacity: isPending ? 0.4 : 1,
        transition: 'opacity 150ms ease-out',
        position: 'relative',
      }}
    >
      {isPending && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <Spinner />
        </div>
      )}
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div
      aria-label="loading"
      style={{
        width: 16, height: 16,
        border: '2px solid #c5b89f',
        borderTopColor: '#f5a623',
        borderRadius: '50%',
        animation: 'stats-spin 800ms linear infinite',
      }}
    />
  )
}
```

- [ ] **Step 2: Create `DateFilter.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { useRouteTransition } from './TransitionDimmer'
import type { Range } from '@/lib/stats/types'

const PRESETS: { key: Exclude<Range, 'custom'>; labelNL: string; labelEN: string }[] = [
  { key: 'week',  labelNL: 'Deze week',  labelEN: 'This week' },
  { key: 'month', labelNL: 'Deze maand', labelEN: 'This month' },
  { key: 'year',  labelNL: 'Dit jaar',   labelEN: 'This year' },
  { key: 'all',   labelNL: 'Alles',      labelEN: 'All time' },
]

export function DateFilter({ locale }: { locale: 'nl' | 'en' }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startTransition } = useRouteTransition()

  const currentRange = (searchParams.get('range') ?? 'all') as Range
  const [showCustom, setShowCustom] = useState(currentRange === 'custom')
  const [from, setFrom] = useState(searchParams.get('from') ?? '')
  const [to, setTo] = useState(searchParams.get('to') ?? '')

  function pushRange(next: Range, extra?: { from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', next)
    params.delete('from')
    params.delete('to')
    if (next === 'custom' && extra?.from && extra?.to) {
      params.set('from', extra.from)
      params.set('to', extra.to)
    }
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const pillBase = {
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #c5b89f',
    cursor: 'pointer',
    background: '#fefcf8',
    color: '#6b5e4a',
  } as const
  const pillActive = { background: '#fff3d4', color: '#c27f0a', borderColor: '#f5a623' }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 20 }}>
      {PRESETS.map(p => {
        const active = currentRange === p.key
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => { setShowCustom(false); pushRange(p.key) }}
            style={{ ...pillBase, ...(active ? pillActive : {}) }}
          >
            {locale === 'nl' ? p.labelNL : p.labelEN}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setShowCustom(v => !v)}
        style={{ ...pillBase, ...(currentRange === 'custom' ? pillActive : {}) }}
      >
        {locale === 'nl' ? 'Aangepast' : 'Custom'}
      </button>
      {showCustom && (
        <form
          onSubmit={e => { e.preventDefault(); if (from && to) pushRange('custom', { from, to }) }}
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}
        >
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} required
                 style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #c5b89f', fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#6b5e4a' }}>—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} required
                 style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #c5b89f', fontSize: 12 }} />
          <button type="submit" style={{ ...pillBase, ...pillActive }}>
            {locale === 'nl' ? 'Toepassen' : 'Apply'}
          </button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wrap `DashboardClient` with `TransitionProvider` and render filter**

```tsx
// top of DashboardClient.tsx
import { TransitionProvider, DimmedWhilePending } from '@/components/stats/TransitionDimmer'
import { DateFilter } from '@/components/stats/DateFilter'

// inside the default export, wrap the existing JSX:
export default function DashboardClient({ stats, gamesPage, filter, locale = 'nl' }: {
  stats: StatsBundle
  gamesPage: GamesPage<CompactGameRow>
  filter: DateFilter
  locale?: 'nl' | 'en'
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    params.set('range', filter.range)
    if (filter.range === 'custom' && filter.from && filter.to) {
      params.set('from', filter.from.toISOString().slice(0, 10))
      params.set('to', filter.to.toISOString().slice(0, 10))
    }
    params.set('page', String(p))
    return `?${params.toString()}`
  }

  return (
    <TransitionProvider>
      <DateFilter locale={locale} />
      <DimmedWhilePending>
        {/* existing 2-col grid of panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }} className="sm:grid-cols-2 grid-cols-1">
          <RankingPanel ranking={stats.ranking} />
          {stats.topGames && <TopGamesPanel topGames={stats.topGames} />}
          <PlayDaysPanel playDays={stats.playDays} />
          {stats.leagues && <LeaguesPanel leagues={stats.leagues} />}
        </div>
        <PaginatedGamesTable variant="compact" page={gamesPage} buildHref={buildHref} />
      </DimmedWhilePending>
    </TransitionProvider>
  )
}
```

Update `page.tsx` to pass `locale`:

```tsx
<DashboardClient stats={stats} gamesPage={gamesPage} filter={filter} locale={locale} />
```

- [ ] **Step 4: Typecheck + dev-server smoke**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test"
npm run dev
# visit /app/dashboard, click Deze week / Deze maand / Aangepast; verify URL updates and stats re-render
```

- [ ] **Step 5: Commit**

```bash
git add src/components/stats/DateFilter.tsx src/components/stats/TransitionDimmer.tsx src/app/app/dashboard/DashboardClient.tsx src/app/app/dashboard/page.tsx
git commit -m "feat(stats): DateFilter + useTransition dimming; dashboard reads range from URL"
```

---

## Task 6: Skeletons + `loading.tsx` + animation CSS

**Files:**
- Create: `src/components/stats/StatsSkeleton.tsx`
- Create: `src/components/stats/stats.css`
- Create: `src/app/app/dashboard/loading.tsx`
- Modify: `src/app/globals.css` (import new CSS)

- [ ] **Step 1: Create `stats.css`**

```css
@keyframes stats-pulse {
  0%   { opacity: 0.35; }
  50%  { opacity: 0.7; }
  100% { opacity: 0.35; }
}

@keyframes stats-grow {
  from { width: 0; }
  to   { width: var(--stats-bar-target); }
}

@keyframes stats-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes stats-spin {
  to { transform: rotate(360deg); }
}

.stats-bar {
  animation: stats-grow 400ms cubic-bezier(0.2, 0, 0, 1);
}

.stats-card {
  animation: stats-fade-up 300ms ease-out backwards;
  animation-delay: calc(var(--stats-card-index, 0) * 50ms);
}

.stats-skeleton-block {
  animation: stats-pulse 1.2s ease-in-out infinite;
  background: #ede5d8;
  border-radius: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .stats-bar,
  .stats-card,
  .stats-skeleton-block {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Import `stats.css` globally**

Add to `src/app/globals.css`:

```css
@import '../components/stats/stats.css';
```

- [ ] **Step 3: Create `StatsSkeleton.tsx`**

```tsx
import { Card } from './Card'

export function StatsSkeleton({ panelCount = 4, chart = false }: { panelCount?: number; chart?: boolean }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="stats-skeleton-block" style={{ width: 90, height: 28, borderRadius: 999 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }} className="sm:grid-cols-2 grid-cols-1">
        {Array.from({ length: panelCount }).map((_, i) => (
          <Card key={i}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #ede5d8' }}>
              <div className="stats-skeleton-block" style={{ height: 14, width: '50%' }} />
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chart
                ? <div className="stats-skeleton-block" style={{ height: 220 }} />
                : [1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="stats-skeleton-block" style={{ height: 9, width: `${90 - n * 8}%` }} />
                  ))
              }
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #ede5d8' }}>
          <div className="stats-skeleton-block" style={{ height: 14, width: '30%' }} />
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(n => <div key={n} className="stats-skeleton-block" style={{ height: 11 }} />)}
        </div>
      </Card>
    </>
  )
}
```

- [ ] **Step 4: Create `src/app/app/dashboard/loading.tsx`**

```tsx
import { StatsSkeleton } from '@/components/stats/StatsSkeleton'

export default function DashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div style={{ marginBottom: 24 }}>
        <div className="stats-skeleton-block" style={{ height: 24, width: 280, marginBottom: 4 }} />
        <div className="stats-skeleton-block" style={{ height: 12, width: 120 }} />
      </div>
      <StatsSkeleton panelCount={4} />
    </div>
  )
}
```

- [ ] **Step 5: Add `stats-card` class + `--stats-card-index` to dashboard cards**

In `DashboardClient.tsx`, wrap each panel with an index-bearing div, or update `Card` to accept an `index` prop:

```tsx
// Card.tsx — extend signature:
export function Card({ children, style, index }: { children: ReactNode; style?: CSSProperties; index?: number }) {
  const vars = index !== undefined ? ({ ['--stats-card-index' as string]: index } as CSSProperties) : {}
  return (
    <div
      className="stats-card"
      style={{
        background: '#fefcf8',
        border: '1px solid #c5b89f',
        borderRadius: 16,
        overflow: 'hidden',
        ...vars,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

Pass `index={0..3}` to each `Card` wrapped panel in `DashboardClient`.

- [ ] **Step 6: Dev smoke**

```bash
npm run dev
# visit /app/dashboard — observe 300ms staggered fade-up on initial load
# click a preset — observe 40% opacity + spinner, then reveal
# ctrl+shift+R — skeleton appears for ~500ms before full render
```

- [ ] **Step 7: Commit**

```bash
git add src/components/stats/StatsSkeleton.tsx src/components/stats/stats.css src/components/stats/Card.tsx src/app/globals.css src/app/app/dashboard/loading.tsx src/app/app/dashboard/DashboardClient.tsx
git commit -m "feat(stats): skeleton loading state + bar/panel animations + reduced-motion respect"
```

---

## Task 7: Chart primitives (`AnimatedNumber`, `MissionChart`, `GamesFrequencyChart`)

**Files:**
- Create: `src/components/stats/AnimatedNumber.tsx`
- Create: `src/components/stats/MissionChart.tsx`
- Create: `src/components/stats/GamesFrequencyChart.tsx`
- Create: `src/lib/stats/missions.ts` (real implementation replacing stub)
- Create: `src/lib/stats/gamesFrequency.ts` (real implementation replacing stub)
- Test: `src/lib/stats/missions.test.ts`
- Test: `src/lib/stats/gamesFrequency.test.ts`

- [ ] **Step 1: Create `AnimatedNumber.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

export function AnimatedNumber({ value, durationMs = 600 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0)
  const startTs = useRef<number | null>(null)
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reducedMotion) { setDisplay(value); return }
    let raf = 0
    const tick = (ts: number) => {
      if (startTs.current === null) startTs.current = ts
      const t = Math.min(1, (ts - startTs.current) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(value * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); startTs.current = null }
  }, [value, durationMs, reducedMotion])

  return <>{display}</>
}
```

- [ ] **Step 2: Write `missions.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeMissionStats } from './missions'
import type { AggregatorGame } from './types'

function g(winningMission: string | null): AggregatorGame {
  return {
    id: Math.random().toString(), playedAt: new Date(),
    winningMission, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: ['A', 'B', 'C'] } },
    scores: [],
  }
}

describe('computeMissionStats', () => {
  it('returns null when no winningMission values anywhere', () => {
    expect(computeMissionStats([g(null), g(null)])).toBeNull()
    expect(computeMissionStats([])).toBeNull()
  })

  it('counts missions sorted desc', () => {
    const games = [g('A'), g('A'), g('B'), g(null), g('A'), g('C')]
    expect(computeMissionStats(games)).toEqual([
      { name: 'A', count: 3 },
      { name: 'B', count: 1 },
      { name: 'C', count: 1 },
    ])
  })
})
```

- [ ] **Step 3: Implement `missions.ts`**

```ts
import type { AggregatorGame, MissionStat } from './types'

export function computeMissionStats(games: AggregatorGame[]): MissionStat[] | null {
  const counts: Record<string, number> = {}
  let any = false
  for (const g of games) {
    if (g.winningMission) {
      counts[g.winningMission] = (counts[g.winningMission] ?? 0) + 1
      any = true
    }
  }
  if (!any) return null
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
```

Run: `npx vitest run src/lib/stats/missions.test.ts`. Expected: PASS.

- [ ] **Step 4: Write `gamesFrequency.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeGamesFrequency } from './gamesFrequency'
import type { AggregatorGame } from './types'

function g(playedAt: string): AggregatorGame {
  return {
    id: playedAt, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: [],
  }
}

describe('computeGamesFrequency', () => {
  it('buckets by week when range ≤ 2 months', () => {
    const games = [
      g('2026-04-20T10:00:00Z'), // Monday
      g('2026-04-21T10:00:00Z'), // Tuesday — same week
      g('2026-04-14T10:00:00Z'), // prior Tuesday — different week
    ]
    const buckets = computeGamesFrequency(games, {
      range: 'month', from: new Date('2026-04-01T00:00:00Z'), to: null,
    })
    // Expect one bucket with count 2 (current week) and one with count 1 (prior week)
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(3)
    expect(Math.max(...buckets.map(b => b.count))).toBe(2)
  })

  it('buckets by month when range > 2 months or all', () => {
    const games = [g('2026-01-05T00:00:00Z'), g('2026-03-05T00:00:00Z'), g('2026-03-20T00:00:00Z')]
    const buckets = computeGamesFrequency(games, {
      range: 'all', from: null, to: null,
    })
    expect(buckets.find(b => b.count === 2)).toBeTruthy() // March bucket
  })

  it('returns empty for no games', () => {
    expect(computeGamesFrequency([], { range: 'all', from: null, to: null })).toEqual([])
  })
})
```

- [ ] **Step 5: Implement `gamesFrequency.ts`**

```ts
import type { AggregatorGame, DateFilter, FrequencyBucket } from './types'

const TWO_MONTHS_MS = 62 * 86_400_000

function rangeSpanMs(filter: DateFilter, games: AggregatorGame[]): number {
  if (filter.from && filter.to) return filter.to.getTime() - filter.from.getTime()
  if (filter.from) return Date.now() - filter.from.getTime()
  if (games.length === 0) return 0
  const first = Math.min(...games.map(g => g.playedAt.getTime()))
  return Date.now() - first
}

function weekStartUTC(d: Date): Date {
  const day = d.getUTCDay()
  const diff = (day + 6) % 7
  const w = new Date(d)
  w.setUTCDate(w.getUTCDate() - diff)
  w.setUTCHours(0, 0, 0, 0)
  return w
}

function monthStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function computeGamesFrequency(games: AggregatorGame[], filter: DateFilter): FrequencyBucket[] {
  if (games.length === 0) return []
  const weekly = rangeSpanMs(filter, games) <= TWO_MONTHS_MS

  const buckets: Record<string, { count: number; start: Date }> = {}
  for (const g of games) {
    const start = weekly ? weekStartUTC(g.playedAt) : monthStartUTC(g.playedAt)
    const key = start.toISOString()
    if (!buckets[key]) buckets[key] = { count: 0, start }
    buckets[key].count++
  }

  const fmtWeek = (d: Date) => `${d.getUTCDate()} ${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][d.getUTCMonth()]}`
  const fmtMonth = (d: Date) => `${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`

  return Object.values(buckets)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(({ count, start }) => ({
      label: weekly ? fmtWeek(start) : fmtMonth(start),
      startISO: start.toISOString(),
      count,
    }))
}
```

Run: `npx vitest run src/lib/stats/gamesFrequency.test.ts`. Expected: PASS.

- [ ] **Step 6: Create `MissionChart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { MissionStat } from '@/lib/stats/types'

export function MissionChart({ missions }: { missions: MissionStat[] }) {
  if (missions.length <= 2) {
    // Fall back to a list when too few bars
    return (
      <div style={{ padding: '0 18px' }}>
        {missions.map((m, i) => (
          <div key={m.name} style={{ display: 'flex', padding: '8px 0', borderBottom: i < missions.length - 1 ? '1px solid #f2ece3' : undefined }}>
            <span style={{ flex: 1, fontSize: 13 }}>{m.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{m.count}×</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ padding: '12px 8px', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={missions} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#1e1a14' }} />
          <Tooltip cursor={{ fill: 'rgba(245,166,35,0.08)' }} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {missions.map((_, i) => <Cell key={i} fill={i === 0 ? '#f5a623' : '#c5b89f'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 7: Create `GamesFrequencyChart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { FrequencyBucket } from '@/lib/stats/types'

export function GamesFrequencyChart({ buckets }: { buckets: FrequencyBucket[] }) {
  if (buckets.length === 0) {
    return <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 18px' }}>Geen data voor deze periode.</p>
  }
  return (
    <div style={{ padding: '12px 8px', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b5e4a' }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b5e4a' }} width={30} />
          <Tooltip cursor={{ fill: 'rgba(245,166,35,0.08)' }} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" fill="#f5a623" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 8: Run full stats tests**

```bash
npx vitest run src/lib/stats/
```

Expected: all passing.

- [ ] **Step 9: Commit**

```bash
git add src/components/stats/AnimatedNumber.tsx src/components/stats/MissionChart.tsx src/components/stats/GamesFrequencyChart.tsx src/lib/stats/missions.ts src/lib/stats/missions.test.ts src/lib/stats/gamesFrequency.ts src/lib/stats/gamesFrequency.test.ts
git commit -m "feat(stats): missions + gamesFrequency aggregators + chart components + AnimatedNumber"
```

---

## Task 8: Wire Missions + GamesFrequency into the dashboard

**Files:**
- Modify: `src/app/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add two new panel components inside `DashboardClient.tsx`**

```tsx
import { MissionChart } from '@/components/stats/MissionChart'
import { GamesFrequencyChart } from '@/components/stats/GamesFrequencyChart'
import { AnimatedNumber } from '@/components/stats/AnimatedNumber'
import type { StatsBundle } from '@/lib/stats/types'

function MissionsPanel({ missions }: { missions: NonNullable<StatsBundle['missions']> }) {
  return (
    <Card index={4}>
      <PanelHeader title="🎯 Meest gewonnen missies" subtitle={`top: ${missions[0].count}×`} />
      <MissionChart missions={missions} />
    </Card>
  )
}

function GamesFrequencyPanel({ buckets }: { buckets: StatsBundle['gamesFrequency'] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0)
  return (
    <Card index={5}>
      <PanelHeader title="📈 Speelfrequentie" subtitle={total > 0 ? `${total} partijen` : undefined} />
      <GamesFrequencyChart buckets={buckets} />
    </Card>
  )
}
```

Update the 2-col grid inside the default export:

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }} className="sm:grid-cols-2 grid-cols-1">
  <RankingPanel ranking={stats.ranking} />
  {stats.topGames && <TopGamesPanel topGames={stats.topGames} />}
  <PlayDaysPanel playDays={stats.playDays} />
  {stats.leagues && <LeaguesPanel leagues={stats.leagues} />}
  {stats.missions && <MissionsPanel missions={stats.missions} />}
  <GamesFrequencyPanel buckets={stats.gamesFrequency} />
</div>
```

Apply `AnimatedNumber` to top-row metrics. In `RankingPanel`, replace `{ranking[0].wins} wins` for position 0 only:

```tsx
<span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>
  {i === 0 ? <><AnimatedNumber value={p.wins} /> wins</> : `${p.wins} wins`}
</span>
```

Same treatment for `PlayDaysPanel` top-day value.

- [ ] **Step 2: Dev smoke — visit dashboard, confirm both new panels render**

```bash
npm run dev
# /app/dashboard — confirm Missions panel appears (only if any game has a winningMission)
# confirm Games frequency chart renders with bars
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): add Missions chart + Games frequency chart panels + animated headline numbers"
```

---

## Task 9: League-only aggregators (TDD)

**Files:**
- Modify: `src/lib/stats/headToHead.ts`
- Modify: `src/lib/stats/streaks.ts`
- Modify: `src/lib/stats/recentForm.ts`
- Modify: `src/lib/stats/scoreRecords.ts`
- Modify: `src/lib/stats/winTrend.ts`
- Test: `src/lib/stats/headToHead.test.ts`
- Test: `src/lib/stats/streaks.test.ts`
- Test: `src/lib/stats/recentForm.test.ts`
- Test: `src/lib/stats/scoreRecords.test.ts`
- Test: `src/lib/stats/winTrend.test.ts`

For each of the 5, follow the same Red-Green-Commit cycle. Test skeletons below; use the same helper shape as Task 3.

- [ ] **Step 1: `headToHead.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeHeadToHead } from './headToHead'
import type { AggregatorGame, AggregatorMember } from './types'

function g(scores: { playerId: string; score: number }[]): AggregatorGame {
  return {
    id: Math.random().toString(), playedAt: new Date(),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: scores.sort((a, b) => b.score - a.score).map(s => ({
      playerId: s.playerId, score: s.score,
      player: { id: s.playerId, name: s.playerId, avatarSeed: s.playerId, userId: null },
    })),
  }
}

const members: AggregatorMember[] = [
  { playerId: 'p1', name: 'Alice', avatarSeed: 'p1', userId: null },
  { playerId: 'p2', name: 'Bob',   avatarSeed: 'p2', userId: null },
  { playerId: 'p3', name: 'Carol', avatarSeed: 'p3', userId: null },
]

describe('computeHeadToHead', () => {
  it('returns N×N matrix with zero diagonal', () => {
    const m = computeHeadToHead([], members)
    expect(m.players).toHaveLength(3)
    expect(m.cells).toHaveLength(3)
    expect(m.cells.every((r, i) => r[i] === 0)).toBe(true)
  })

  it('counts A>B pairs correctly', () => {
    const games = [
      g([{ playerId: 'p1', score: 10 }, { playerId: 'p2', score: 5 }, { playerId: 'p3', score: 3 }]),
      g([{ playerId: 'p2', score: 7 }, { playerId: 'p1', score: 4 }]),
    ]
    const m = computeHeadToHead(games, members)
    // p1 above p2: 1 game, p2 above p1: 1 game
    const idx = (pid: string) => m.players.findIndex(p => p.id === pid)
    expect(m.cells[idx('p1')][idx('p2')]).toBe(1)
    expect(m.cells[idx('p2')][idx('p1')]).toBe(1)
    expect(m.cells[idx('p1')][idx('p3')]).toBe(1)
  })
})
```

- [ ] **Step 2: Implement `headToHead.ts`**

```ts
import type { AggregatorGame, AggregatorMember, HeadToHeadMatrix } from './types'

export function computeHeadToHead(games: AggregatorGame[], members: AggregatorMember[]): HeadToHeadMatrix {
  const players = members.map(m => ({ id: m.playerId, name: m.name, avatarSeed: m.avatarSeed }))
  const idx: Record<string, number> = {}
  players.forEach((p, i) => { idx[p.id] = i })
  const n = players.length
  const cells: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (const g of games) {
    const inGame = g.scores.filter(s => idx[s.playerId] !== undefined)
    // scores already sorted desc by score
    for (let i = 0; i < inGame.length; i++) {
      for (let j = i + 1; j < inGame.length; j++) {
        const a = idx[inGame[i].playerId]
        const b = idx[inGame[j].playerId]
        cells[a][b]++
      }
    }
  }
  return { players, cells }
}
```

Run: `npx vitest run src/lib/stats/headToHead.test.ts`. Expected: PASS.

- [ ] **Step 3: `streaks.test.ts`** + `streaks.ts`

Test:

```ts
import { describe, it, expect } from 'vitest'
import { computeStreaks } from './streaks'
import type { AggregatorGame, AggregatorMember } from './types'

function game(playedAt: string, winnerId: string, otherId: string): AggregatorGame {
  return {
    id: playedAt, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: [
      { playerId: winnerId, score: 10, player: { id: winnerId, name: winnerId, avatarSeed: winnerId, userId: null } },
      { playerId: otherId, score: 1, player: { id: otherId, name: otherId, avatarSeed: otherId, userId: null } },
    ],
  }
}

const members: AggregatorMember[] = [
  { playerId: 'p1', name: 'Alice', avatarSeed: 'p1', userId: null },
  { playerId: 'p2', name: 'Bob', avatarSeed: 'p2', userId: null },
]

describe('computeStreaks', () => {
  it('computes current + longest streak per member', () => {
    const games = [
      game('2026-04-01', 'p1', 'p2'),
      game('2026-04-02', 'p1', 'p2'),
      game('2026-04-03', 'p2', 'p1'),
      game('2026-04-04', 'p1', 'p2'),
    ]
    const s = computeStreaks(games, members)!
    const alice = s.find(e => e.playerId === 'p1')!
    const bob = s.find(e => e.playerId === 'p2')!
    expect(alice.currentStreak).toBe(1) // last game is a win
    expect(alice.longestStreak).toBe(2)
    expect(bob.currentStreak).toBe(0) // last game is a loss
    expect(bob.longestStreak).toBe(1)
  })

  it('filters members with zero wins', () => {
    const games = [game('2026-04-01', 'p1', 'p2')]
    const s = computeStreaks(games, members)
    expect(s!.find(e => e.playerId === 'p2')).toBeUndefined()
  })
})
```

Implementation:

```ts
import type { AggregatorGame, AggregatorMember, StreakEntry } from './types'

export function computeStreaks(games: AggregatorGame[], members: AggregatorMember[]): StreakEntry[] | null {
  if (games.length === 0) return []
  const sorted = [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())
  const playerWins: Record<string, boolean[]> = {}  // chronological per player (only games they played)
  for (const g of sorted) {
    const winnerId = g.scores[0]?.playerId
    for (const s of g.scores) {
      if (!playerWins[s.playerId]) playerWins[s.playerId] = []
      playerWins[s.playerId].push(s.playerId === winnerId)
    }
  }
  const entries: StreakEntry[] = []
  for (const m of members) {
    const results = playerWins[m.playerId] ?? []
    if (!results.some(Boolean)) continue
    let longest = 0, run = 0, current = 0
    for (const w of results) { if (w) { run++; longest = Math.max(longest, run) } else run = 0 }
    // current: walk from end backwards over *their* games
    for (let i = results.length - 1; i >= 0; i--) { if (results[i]) current++; else break }
    entries.push({ playerId: m.playerId, name: m.name, avatarSeed: m.avatarSeed, currentStreak: current, longestStreak: longest })
  }
  return entries.sort((a, b) => b.longestStreak - a.longestStreak || b.currentStreak - a.currentStreak)
}
```

Run: `npx vitest run src/lib/stats/streaks.test.ts`. Expected: PASS.

- [ ] **Step 4: `recentForm.test.ts`** + `recentForm.ts`

Test:

```ts
import { describe, it, expect } from 'vitest'
import { computeRecentForm } from './recentForm'
import type { AggregatorGame, AggregatorMember } from './types'

function game(playedAt: string, scores: { playerId: string; score: number; userId?: string | null }[]): AggregatorGame {
  return {
    id: playedAt, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: scores.sort((a, b) => b.score - a.score).map(s => ({
      playerId: s.playerId, score: s.score,
      player: { id: s.playerId, name: s.playerId, avatarSeed: s.playerId, userId: s.userId ?? null },
    })),
  }
}

describe('computeRecentForm', () => {
  it('returns last 5 W/L in newest-first order', () => {
    const members: AggregatorMember[] = [
      { playerId: 'p1', name: 'A', avatarSeed: 'p1', userId: 'u1' },
      { playerId: 'p2', name: 'B', avatarSeed: 'p2', userId: null },
    ]
    const games = [
      game('2026-04-01', [{ playerId: 'p1', score: 10 }, { playerId: 'p2', score: 5 }]),
      game('2026-04-02', [{ playerId: 'p2', score: 9 }, { playerId: 'p1', score: 3 }]),
      game('2026-04-03', [{ playerId: 'p1', score: 8 }, { playerId: 'p2', score: 7 }]),
    ]
    const rows = computeRecentForm(games, members, 'u1')!
    const alice = rows.find(r => r.playerId === 'p1')!
    expect(alice.results).toEqual(['W', 'L', 'W']) // newest first
    expect(alice.isCurrentUser).toBe(true)
  })
})
```

Implementation:

```ts
import type { AggregatorGame, AggregatorMember, RecentFormRow } from './types'

export function computeRecentForm(
  games: AggregatorGame[],
  members: AggregatorMember[],
  viewerId: string | undefined,
): RecentFormRow[] | null {
  if (games.length === 0) return []
  const sortedDesc = [...games].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
  return members.map(m => {
    const results: ('W' | 'L')[] = []
    for (const g of sortedDesc) {
      const played = g.scores.some(s => s.playerId === m.playerId)
      if (!played) continue
      const won = g.scores[0]?.playerId === m.playerId
      results.push(won ? 'W' : 'L')
      if (results.length === 5) break
    }
    return {
      playerId: m.playerId, name: m.name, avatarSeed: m.avatarSeed,
      isCurrentUser: viewerId != null && m.userId === viewerId,
      results,
    }
  })
}
```

Run + commit after all 5. See step 7 for full commit.

- [ ] **Step 5: `scoreRecords.test.ts`** + `scoreRecords.ts`

Test:

```ts
import { describe, it, expect } from 'vitest'
import { computeScoreRecords } from './scoreRecords'
import type { AggregatorGame } from './types'

function game(scores: { playerId: string; name: string; score: number }[], playedAt = '2026-04-20T00:00:00Z'): AggregatorGame {
  return {
    id: Math.random().toString(), playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: scores.sort((a, b) => b.score - a.score).map(s => ({
      playerId: s.playerId, score: s.score,
      player: { id: s.playerId, name: s.name, avatarSeed: s.playerId, userId: null },
    })),
  }
}

describe('computeScoreRecords', () => {
  it('returns highest, highestLoss, average winner', () => {
    const games = [
      game([{ playerId: 'p1', name: 'A', score: 100 }, { playerId: 'p2', name: 'B', score: 80 }]),
      game([{ playerId: 'p1', name: 'A', score: 40 }, { playerId: 'p2', name: 'B', score: 90 }]),
    ]
    const r = computeScoreRecords(games)
    expect(r.highest?.score).toBe(100)
    expect(r.highest?.playerName).toBe('A')
    expect(r.highestLoss?.score).toBe(80)
    expect(r.averageWinner).toBe(95) // (100 + 90) / 2
  })

  it('null fields when no games', () => {
    expect(computeScoreRecords([])).toEqual({ highest: null, highestLoss: null, averageWinner: null })
  })
})
```

Implementation:

```ts
import type { AggregatorGame, ScoreRecords } from './types'

export function computeScoreRecords(games: AggregatorGame[]): ScoreRecords {
  if (games.length === 0) return { highest: null, highestLoss: null, averageWinner: null }

  let highest: ScoreRecords['highest'] = null
  let highestLoss: ScoreRecords['highestLoss'] = null
  let winnerSum = 0, winnerCount = 0

  for (const g of games) {
    const winner = g.scores[0]
    if (!winner) continue
    if (!highest || winner.score > highest.score) {
      highest = { playerName: winner.player.name, score: winner.score, playedAt: g.playedAt.toISOString() }
    }
    // highestLoss: max score that is NOT #1 in any game
    for (let i = 1; i < g.scores.length; i++) {
      const s = g.scores[i]
      if (!highestLoss || s.score > highestLoss.score) {
        highestLoss = { playerName: s.player.name, score: s.score, playedAt: g.playedAt.toISOString() }
      }
    }
    winnerSum += winner.score
    winnerCount++
  }

  // NOTE: highest can include losing scores too if a loser scores higher than some winner.
  // Per spec, highest = max single ScoreEntry.score overall.
  for (const g of games) for (const s of g.scores) {
    if (!highest || s.score > highest.score) {
      highest = { playerName: s.player.name, score: s.score, playedAt: g.playedAt.toISOString() }
    }
  }

  return {
    highest,
    highestLoss,
    averageWinner: winnerCount > 0 ? Math.round(winnerSum / winnerCount) : null,
  }
}
```

Run: `npx vitest run src/lib/stats/scoreRecords.test.ts`. Expected: PASS.

- [ ] **Step 6: `winTrend.test.ts`** + `winTrend.ts`

Test:

```ts
import { describe, it, expect } from 'vitest'
import { computeWinTrend } from './winTrend'
import type { AggregatorGame, AggregatorMember } from './types'

function game(playedAt: string, winnerId: string, otherId: string): AggregatorGame {
  return {
    id: playedAt, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: [
      { playerId: winnerId, score: 10, player: { id: winnerId, name: winnerId, avatarSeed: winnerId, userId: null } },
      { playerId: otherId, score: 1, player: { id: otherId, name: otherId, avatarSeed: otherId, userId: null } },
    ],
  }
}

const members: AggregatorMember[] = [
  { playerId: 'p1', name: 'Alice', avatarSeed: 'p1', userId: null },
  { playerId: 'p2', name: 'Bob', avatarSeed: 'p2', userId: null },
]

describe('computeWinTrend', () => {
  it('builds cumulative wins per top-5 player', () => {
    const games = [
      game('2026-04-01', 'p1', 'p2'),
      game('2026-04-02', 'p2', 'p1'),
      game('2026-04-03', 'p1', 'p2'),
    ]
    const trend = computeWinTrend(games, members)!
    expect(trend.players).toHaveLength(2)
    expect(trend.points).toHaveLength(3)
    expect(trend.points[0].gameIndex).toBe(1)
    expect(trend.points[2].p1).toBe(2)
    expect(trend.points[2].p2).toBe(1)
  })
})
```

Implementation:

```ts
import type { AggregatorGame, AggregatorMember, WinTrendSeries } from './types'

const PALETTE = ['#f5a623', '#1e8e6f', '#7a4fc2', '#c83f5c', '#2a6cb3']

function colorFor(seed: string, index: number): string {
  return PALETTE[index % PALETTE.length]
}

export function computeWinTrend(games: AggregatorGame[], members: AggregatorMember[]): WinTrendSeries | null {
  if (games.length === 0) return null
  const sorted = [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())

  const totalWins: Record<string, number> = {}
  for (const g of sorted) {
    const w = g.scores[0]?.playerId
    if (w) totalWins[w] = (totalWins[w] ?? 0) + 1
  }

  const topIds = Object.entries(totalWins)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const top = topIds
    .map((id, i) => {
      const m = members.find(x => x.playerId === id)
      if (!m) return null
      return { id, name: m.name, color: colorFor(m.avatarSeed, i) }
    })
    .filter((x): x is { id: string; name: string; color: string } => x !== null)

  if (top.length === 0) return null

  const running: Record<string, number> = {}
  top.forEach(p => { running[p.id] = 0 })
  const points: WinTrendSeries['points'] = []
  sorted.forEach((g, i) => {
    const w = g.scores[0]?.playerId
    if (w && running[w] !== undefined) running[w]++
    points.push({ gameIndex: i + 1, ...running })
  })

  return { players: top, points }
}
```

Run: `npx vitest run src/lib/stats/winTrend.test.ts`. Expected: PASS.

- [ ] **Step 7: Run full suite, commit**

```bash
npx vitest run src/lib/stats/
```

Expected: all passing.

```bash
git add src/lib/stats/headToHead.ts src/lib/stats/headToHead.test.ts src/lib/stats/streaks.ts src/lib/stats/streaks.test.ts src/lib/stats/recentForm.ts src/lib/stats/recentForm.test.ts src/lib/stats/scoreRecords.ts src/lib/stats/scoreRecords.test.ts src/lib/stats/winTrend.ts src/lib/stats/winTrend.test.ts
git commit -m "feat(stats): league-scope aggregators — headToHead, streaks, recentForm, scoreRecords, winTrend (TDD)"
```

---

## Task 10: League page — `HeadToHeadGrid`, `WinTrendChart`, `LeagueStatsClient`

**Files:**
- Create: `src/components/stats/HeadToHeadGrid.tsx`
- Create: `src/components/stats/WinTrendChart.tsx`
- Create: `src/app/app/leagues/[id]/LeagueStatsClient.tsx`
- Create: `src/app/app/leagues/[id]/loading.tsx`

- [ ] **Step 1: Create `WinTrendChart.tsx`**

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { WinTrendSeries } from '@/lib/stats/types'

export function WinTrendChart({ series }: { series: WinTrendSeries }) {
  return (
    <div style={{ padding: '12px 8px', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series.points} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <XAxis dataKey="gameIndex" tick={{ fontSize: 11, fill: '#6b5e4a' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b5e4a' }} width={30} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.players.map(p => (
            <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create `HeadToHeadGrid.tsx`**

```tsx
import { Avatar } from '@/components/shared/Avatar'
import type { HeadToHeadMatrix } from '@/lib/stats/types'

export function HeadToHeadGrid({ matrix }: { matrix: HeadToHeadMatrix }) {
  const { players, cells } = matrix
  const n = players.length

  return (
    <>
      {/* Desktop grid */}
      <div className="hidden sm:block" style={{ padding: '12px 18px', overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th></th>
              {players.map(p => (
                <th key={p.id} style={{ padding: '4px 6px', fontWeight: 600, color: '#6b5e4a', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 80 }}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((row, i) => (
              <tr key={row.id}>
                <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 600, color: '#1e1a14' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar seed={row.avatarSeed} name={row.name} size={20} />{row.name}
                  </div>
                </th>
                {players.map((col, j) => {
                  const v = cells[i][j]
                  const colV = cells[j][i]
                  const leads = v > colV
                  const equal = i === j
                  return (
                    <td key={col.id} style={{
                      padding: '4px 6px', textAlign: 'center', minWidth: 30,
                      border: '1px solid #ede5d8',
                      background: equal ? '#f2ece3' : leads ? 'rgba(245,166,35,0.15)' : '#fefcf8',
                      color: equal ? '#c4b79a' : '#1e1a14',
                    }}>
                      {equal ? '—' : v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile per-player list */}
      <div className="sm:hidden" style={{ padding: '0 18px' }}>
        {players.map((p, i) => {
          let best = { opponent: '', w: 0, l: 0 }
          let worst = { opponent: '', w: 99, l: 0 }
          for (let j = 0; j < n; j++) {
            if (i === j) continue
            const w = cells[i][j]
            const l = cells[j][i]
            const diff = w - l
            if (w + l > 0 && diff > best.w - best.l) best = { opponent: players[j].name, w, l }
            if (w + l > 0 && diff < worst.w - worst.l) worst = { opponent: players[j].name, w, l }
          }
          return (
            <div key={p.id} style={{ padding: '11px 0', borderBottom: i < n - 1 ? '1px solid #f2ece3' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar seed={p.avatarSeed} name={p.name} size={22} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e1a14' }}>{p.name}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b5e4a' }}>
                {best.opponent && <>Beste: <strong>{best.opponent}</strong> ({best.w}–{best.l}) · </>}
                {worst.opponent && <>Slechtste: <strong>{worst.opponent}</strong> ({worst.w}–{worst.l})</>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Create `LeagueStatsClient.tsx`**

```tsx
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import { Card } from '@/components/stats/Card'
import { PanelHeader } from '@/components/stats/PanelHeader'
import { RankedListRow } from '@/components/stats/RankedListRow'
import { StatBar } from '@/components/stats/StatBar'
import { HeadToHeadGrid } from '@/components/stats/HeadToHeadGrid'
import { MissionChart } from '@/components/stats/MissionChart'
import { WinTrendChart } from '@/components/stats/WinTrendChart'
import { GamesFrequencyChart } from '@/components/stats/GamesFrequencyChart'
import { AnimatedNumber } from '@/components/stats/AnimatedNumber'
import { DateFilter } from '@/components/stats/DateFilter'
import { TransitionProvider, DimmedWhilePending } from '@/components/stats/TransitionDimmer'
import { PaginatedGamesTable, type VerboseGameRow, type GamesPage } from '@/components/stats/PaginatedGamesTable'
import type { StatsBundle, DateFilter as DF } from '@/lib/stats/types'

export function LeagueStatsClient({
  stats,
  gamesPage,
  filter,
  locale,
  memberCount,
  renderRowActions,
}: {
  stats: StatsBundle
  gamesPage: GamesPage<VerboseGameRow>
  filter: DF
  locale: 'nl' | 'en'
  memberCount: number
  renderRowActions?: (row: VerboseGameRow) => React.ReactNode
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    params.set('range', filter.range)
    if (filter.range === 'custom' && filter.from && filter.to) {
      params.set('from', filter.from.toISOString().slice(0, 10))
      params.set('to', filter.to.toISOString().slice(0, 10))
    }
    params.set('page', String(p))
    return `?${params.toString()}`
  }

  let idx = 0
  const nextIdx = () => idx++

  return (
    <TransitionProvider>
      <DateFilter locale={locale} />
      <DimmedWhilePending>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}
          className="sm:grid-cols-2 grid-cols-1"
        >
          <RankingCard ranking={stats.ranking} index={nextIdx()} />

          {memberCount > 8 ? (
            <Card index={nextIdx()}>
              <PanelHeader title="🤝 Onderlinge resultaten" />
              <p style={{ padding: '16px 18px', fontSize: 13, color: '#9a8c7a' }}>
                Te veel spelers voor head-to-head weergave.
              </p>
            </Card>
          ) : stats.headToHead ? (
            <Card index={nextIdx()}>
              <PanelHeader title="🤝 Onderlinge resultaten" />
              <HeadToHeadGrid matrix={stats.headToHead} />
            </Card>
          ) : null}

          <PlayDaysCard playDays={stats.playDays} index={nextIdx()} />

          {stats.missions && (
            <Card index={nextIdx()}>
              <PanelHeader title="🎯 Meest gewonnen missies" subtitle={`top: ${stats.missions[0].count}×`} />
              <MissionChart missions={stats.missions} />
            </Card>
          )}

          {stats.streaks && stats.streaks.length > 0 && (
            <Card index={nextIdx()}>
              <PanelHeader title="🔥 Winstreeks" />
              <div style={{ padding: '0 18px' }}>
                {stats.streaks.map((s, i) => (
                  <div key={s.playerId} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: i < stats.streaks!.length - 1 ? '1px solid #f2ece3' : undefined }}>
                    <Avatar seed={s.avatarSeed} name={s.name} size={24} />
                    <span style={{ flex: 1, fontSize: 13, marginLeft: 8 }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: s.currentStreak >= 2 ? '#c27f0a' : '#6b5e4a', marginRight: 10, fontWeight: s.currentStreak >= 2 ? 700 : 400 }}>
                      nu: {i === 0 ? <AnimatedNumber value={s.currentStreak} /> : s.currentStreak}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>langste: {i === 0 ? <AnimatedNumber value={s.longestStreak} /> : s.longestStreak}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {stats.recentForm && (
            <Card index={nextIdx()}>
              <PanelHeader title="📊 Recente vorm" />
              <div style={{ padding: '0 18px' }}>
                {stats.recentForm.map((r, i) => (
                  <div key={r.playerId} style={{
                    display: 'flex', alignItems: 'center', padding: '8px 0',
                    borderBottom: i < stats.recentForm!.length - 1 ? '1px solid #f2ece3' : undefined,
                    ...(r.isCurrentUser ? { background: 'rgba(245,166,35,0.07)', margin: '0 -18px', padding: '8px 18px' } : {}),
                  }}>
                    <Avatar seed={r.avatarSeed} name={r.name} size={22} />
                    <span style={{ flex: 1, fontSize: 13, marginLeft: 8, fontWeight: r.isCurrentUser ? 700 : 400 }}>{r.name}</span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {r.results.length === 0
                        ? <span style={{ fontSize: 11, color: '#9a8c7a' }}>geen partijen</span>
                        : r.results.map((res, j) => (
                            <span key={j} style={{
                              display: 'inline-block', minWidth: 18, textAlign: 'center',
                              padding: '1px 4px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                              background: res === 'W' ? '#fff3d4' : '#f2ece3',
                              color: res === 'W' ? '#c27f0a' : '#6b5e4a',
                            }}>{res}</span>
                          ))
                      }
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {stats.scoreRecords && (
            <Card index={nextIdx()}>
              <PanelHeader title="🏆 Recordscores" />
              <div style={{ padding: '0 18px' }}>
                {[
                  { label: 'Hoogste score ooit', data: stats.scoreRecords.highest, tone: 'amber' as const },
                  { label: 'Hoogste verliesscore', data: stats.scoreRecords.highestLoss, tone: 'muted' as const },
                ].map((row, i) => row.data && (
                  <div key={row.label} style={{ display: 'flex', padding: '9px 0', borderBottom: '1px solid #f2ece3', alignItems: 'baseline' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#6b5e4a' }}>{row.label}</span>
                    <span style={{ fontSize: 13, color: '#1e1a14', marginRight: 10 }}>{row.data.playerName}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: row.tone === 'amber' ? '#c27f0a' : '#1e1a14', marginRight: 10 }}>
                      {i === 0 ? <AnimatedNumber value={row.data.score} /> : row.data.score}
                    </span>
                    <span style={{ fontSize: 11, color: '#9a8c7a' }}>
                      {new Date(row.data.playedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
                {stats.scoreRecords.averageWinner !== null && (
                  <div style={{ display: 'flex', padding: '9px 0' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#6b5e4a' }}>Gemiddeld winnaar</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{stats.scoreRecords.averageWinner}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {stats.winTrend && (
            <Card index={nextIdx()}>
              <PanelHeader title="📉 Winst-trend" subtitle="cumulatief per speler" />
              <WinTrendChart series={stats.winTrend} />
            </Card>
          )}

          <Card index={nextIdx()}>
            <PanelHeader title="📈 Speelfrequentie" subtitle={stats.gamesFrequency.length > 0 ? `${stats.gamesFrequency.reduce((s, b) => s + b.count, 0)} partijen` : undefined} />
            <GamesFrequencyChart buckets={stats.gamesFrequency} />
          </Card>
        </div>

        <PaginatedGamesTable variant="verbose" page={gamesPage} buildHref={buildHref} renderRowActions={renderRowActions} />
      </DimmedWhilePending>
    </TransitionProvider>
  )
}

function RankingCard({ ranking, index }: { ranking: StatsBundle['ranking']; index: number }) {
  return (
    <Card index={index}>
      <PanelHeader title="🏆 Ranking" subtitle="alle leden" />
      <div style={{ padding: '0 18px' }}>
        {ranking.map((p, i) => (
          <RankedListRow key={p.playerId} rank={i + 1} isLast={i === ranking.length - 1} highlighted={p.isCurrentUser}>
            <Avatar seed={p.avatarSeed} name={p.name} size={24} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: p.isCurrentUser ? 700 : 400, color: '#1e1a14', marginLeft: 8 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>
              {i === 0 ? <><AnimatedNumber value={p.wins} /> wins</> : `${p.wins} wins`}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14' }}>{p.winRatio}%</span>
          </RankedListRow>
        ))}
        {ranking.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>}
      </div>
    </Card>
  )
}

function PlayDaysCard({ playDays, index }: { playDays: StatsBundle['playDays']; index: number }) {
  const max = Math.max(...playDays.map(d => d.count), 1)
  return (
    <Card index={index}>
      <PanelHeader title="📅 Speeldagen" />
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {playDays.map((d, i) => (
          <StatBar
            key={d.day}
            label={d.label}
            trailingLabel={i === 0 && d.count > 0 ? ' 🔥' : ''}
            value={`${d.count} sessies`}
            ratio={d.count / max}
            highlighted={i === 0 && d.count > 0}
            dimmed={d.count === 0}
          />
        ))}
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Create `loading.tsx` for league route**

```tsx
import { StatsSkeleton } from '@/components/stats/StatsSkeleton'

export default function LeagueLoading() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="stats-skeleton-block" style={{ height: 28, width: 320, marginBottom: 8 }} />
      <div className="stats-skeleton-block" style={{ height: 12, width: 180, marginBottom: 24 }} />
      <StatsSkeleton panelCount={6} chart={false} />
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test"
```

Expected: no production-code errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/stats/WinTrendChart.tsx src/components/stats/HeadToHeadGrid.tsx src/app/app/leagues/[id]/LeagueStatsClient.tsx src/app/app/leagues/[id]/loading.tsx
git commit -m "feat(league): LeagueStatsClient with 9 panels + HeadToHeadGrid + WinTrendChart + loading skeleton"
```

---

## Task 11: Rewrite league `page.tsx` + cache invalidation

**Files:**
- Modify: `src/app/app/leagues/[id]/page.tsx`
- Modify: `src/app/app/leagues/[id]/actions.ts`

- [ ] **Step 1: Rewrite `page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Plus } from 'lucide-react'
import { loadStats } from '@/lib/stats/loadStats'
import { loadGames } from '@/lib/stats/loadGames'
import { parseRange } from '@/lib/stats/dateRange'
import { LeagueStatsClient } from './LeagueStatsClient'
import { PendingApprovalSection } from './PendingApprovalSection'
import { SessionActions } from './SessionActions'
import { ShareButton } from './ShareButton'
import type { VerboseGameRow } from '@/components/stats/PaginatedGamesTable'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string; page?: string }>
}

export default async function LeagueDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const sp = await searchParams
  const filter = parseRange(sp)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const locale = (session.user.locale === 'nl' ? 'nl' : 'en') as 'nl' | 'en'

  const scope = { kind: 'league' as const, leagueId: id, viewerId: session.user.id }

  const [league, stats, gamesPage, pendingGames] = await Promise.all([
    prisma.league.findUnique({
      where: { id },
      include: {
        gameTemplate: { select: { name: true } },
        _count: { select: { members: true } },
      },
    }),
    loadStats(scope, filter, locale),
    loadGames(scope, filter, page, 25, 'verbose'),
    prisma.playedGame.findMany({
      where: { leagueId: id, status: 'pending_approval' },
      include: {
        submittedBy: { select: { email: true } },
        scores: {
          include: { player: { select: { name: true } } },
          orderBy: { score: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!league || league.ownerId !== session.user.id) notFound()

  const renderRowActions = (row: VerboseGameRow) => (
    <>
      {row.shareToken && <ShareButton token={row.shareToken} />}
      <SessionActions playedGameId={row.id} leagueId={id} />
    </>
  )

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
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
          <Plus size={16} /> Log partij
        </Link>
      </div>

      <PendingApprovalSection
        games={pendingGames.map(pg => ({
          id: pg.id,
          playedAt: pg.playedAt.toISOString(),
          submittedByEmail: pg.submittedBy.email,
          scores: pg.scores.map(s => ({ playerName: s.player.name, score: s.score })),
        }))}
      />

      <LeagueStatsClient
        stats={stats}
        gamesPage={gamesPage}
        filter={filter}
        locale={locale}
        memberCount={league._count.members}
        renderRowActions={renderRowActions}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update `actions.ts` — replace every legacy invalidation call**

Read the file first: `cat src/app/app/leagues/[id]/actions.ts` to confirm there are 8 `redis.del` calls using keys `cache:dashboard:${userId}`.

Replace each block of:

```ts
await redis.del(`cache:dashboard:${session.user.id}`)
```

or

```ts
await redis.del(`cache:dashboard:${session.user.id}`)
await redis.del(`cache:dashboard:${pg.submittedById}`)
```

with:

```ts
await invalidateStatsCache({
  userIds: [session.user.id, /* also submittedById when available: */ pg.submittedById].filter((v, i, a) => v && a.indexOf(v) === i),
  leagueIds: [id /* or pg.leagueId */],
})
```

Add the import at the top:

```ts
import { invalidateStatsCache } from '@/lib/stats/invalidateStatsCache'
```

Find the actual `leagueId` variable in each context (usually `id` from the function's param, or `pg.leagueId`) and use that. Remove direct imports of `redis` if no other use remains.

Do this for all 4 actions (`logPlayedGame`, `approvePlayedGame`, `updatePlayedGame`, `deletePlayedGame` — exact names per the file).

- [ ] **Step 3: Typecheck + dev smoke**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test"
npm run dev
# /app/leagues/<some-id> — verify all panels render, filter works, games table shows two-line rows, pagination works
# Log a game, approve a game, edit a session — verify stats update immediately (no 5-min stale window)
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app/leagues/[id]/page.tsx src/app/app/leagues/[id]/actions.ts
git commit -m "feat(league): rewrite page.tsx to stats-centric layout; wire invalidateStatsCache"
```

---

## Task 12: i18n sweep, INDEX.md, push

**Files:**
- Modify: `messages/nl/app.json`
- Modify: `messages/en/app.json`
- Modify: `src/app/app/dashboard/DashboardClient.tsx` (use `getTranslations`)
- Modify: `src/app/app/leagues/[id]/LeagueStatsClient.tsx` (use `getTranslations`)
- Modify: `src/components/stats/PaginatedGamesTable.tsx` (accept translated labels as props)
- Modify: `src/components/stats/DateFilter.tsx` (accept translated labels as props)
- Modify: `docs/superpowers/plans/INDEX.md`

- [ ] **Step 1: Add `app.stats` namespace to `messages/nl/app.json`**

Insert after the `dashboard` key:

```jsonc
"stats": {
  "ranking": "Ranking",
  "rankingSubtitle": "alle leagues",
  "rankingMembers": "alle leden",
  "topGames": "Top spellen",
  "topGamesSubtitle": "meest gespeeld",
  "playDays": "Speeldagen",
  "leaguesPanel": "Leagues",
  "leaguesSubtitle": "meest actief",
  "missions": "Meest gewonnen missies",
  "missionsEmpty": "Geen missies geregistreerd",
  "missionsTop": "top: {count}×",
  "gamesFrequency": "Speelfrequentie",
  "gamesFrequencyEmpty": "Geen data voor deze periode.",
  "headToHead": "Onderlinge resultaten",
  "headToHeadTooMany": "Te veel spelers voor head-to-head weergave.",
  "headToHeadBest": "Beste",
  "headToHeadWorst": "Slechtste",
  "streaks": "Winstreeks",
  "streaksCurrent": "nu: {count}",
  "streaksLongest": "langste: {count}",
  "recentForm": "Recente vorm",
  "recentFormWon": "W",
  "recentFormLost": "V",
  "recentFormNone": "geen partijen",
  "scoreRecords": "Recordscores",
  "scoreRecordsHighest": "Hoogste score ooit",
  "scoreRecordsHighestLoss": "Hoogste verliesscore",
  "scoreRecordsAvgWinner": "Gemiddeld winnaar",
  "winTrend": "Winst-trend",
  "winTrendSubtitle": "cumulatief per speler",
  "gamesTable": "Gespeelde partijen",
  "gamesTableTotal": "{count} totaal · pagina {page} van {totalPages}",
  "gamesTableWinner": "Winnaar:",
  "gamesTableEmpty": "Nog geen partijen gespeeld.",
  "gamesTableHeaderGame": "Spel · League",
  "gamesTableHeaderDate": "Datum",
  "gamesTableHeaderPlayers": "Spelers",
  "gamesTableHeaderResult": "Uitslag",
  "resultWon": "Gewonnen",
  "resultLost": "Verloren",
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
  "rangeApply": "Toepassen",
  "rangeFrom": "Van",
  "rangeTo": "Tot",
  "totalPrefix": "{count} partijen"
}
```

- [ ] **Step 2: Same keys in `messages/en/app.json` with English values**

```jsonc
"stats": {
  "ranking": "Rankings",
  "rankingSubtitle": "all leagues",
  "rankingMembers": "all members",
  "topGames": "Top games",
  "topGamesSubtitle": "most played",
  "playDays": "Play days",
  "leaguesPanel": "Leagues",
  "leaguesSubtitle": "most active",
  "missions": "Most-won missions",
  "missionsEmpty": "No missions recorded",
  "missionsTop": "top: {count}×",
  "gamesFrequency": "Games frequency",
  "gamesFrequencyEmpty": "No data for this period.",
  "headToHead": "Head-to-head",
  "headToHeadTooMany": "Too many players for head-to-head view.",
  "headToHeadBest": "Best",
  "headToHeadWorst": "Worst",
  "streaks": "Win streak",
  "streaksCurrent": "now: {count}",
  "streaksLongest": "longest: {count}",
  "recentForm": "Recent form",
  "recentFormWon": "W",
  "recentFormLost": "L",
  "recentFormNone": "no games",
  "scoreRecords": "Score records",
  "scoreRecordsHighest": "Highest score ever",
  "scoreRecordsHighestLoss": "Highest losing score",
  "scoreRecordsAvgWinner": "Average winner",
  "winTrend": "Win trend",
  "winTrendSubtitle": "cumulative per player",
  "gamesTable": "Played games",
  "gamesTableTotal": "{count} total · page {page} of {totalPages}",
  "gamesTableWinner": "Winner:",
  "gamesTableEmpty": "No games played yet.",
  "gamesTableHeaderGame": "Game · League",
  "gamesTableHeaderDate": "Date",
  "gamesTableHeaderPlayers": "Players",
  "gamesTableHeaderResult": "Result",
  "resultWon": "Won",
  "resultLost": "Lost",
  "wins": "{count} wins",
  "winRatio": "{ratio}%",
  "playCount": "{count}×",
  "playCountSessies": "{count} sessions",
  "playerCount": "{count} player",
  "playerCountPlural": "{count} players",
  "empty": "No games played yet.",
  "emptyLeagues": "No leagues yet.",
  "recencyToday": "today",
  "recencyYesterday": "yesterday",
  "recencyDays": "{count} days ago",
  "recencyOneWeek": "1 week ago",
  "recencyWeeks": "{count} weeks ago",
  "recencyMonths": "{count} months ago",
  "recencyNever": "never played",
  "pagination": "page {page} of {total}",
  "paginationPerPage": "{count} per page",
  "prev": "← Previous",
  "next": "Next →",
  "rangeWeek": "This week",
  "rangeMonth": "This month",
  "rangeYear": "This year",
  "rangeAll": "All time",
  "rangeCustom": "Custom",
  "rangeApply": "Apply",
  "rangeFrom": "From",
  "rangeTo": "To",
  "totalPrefix": "{count} games"
}
```

- [ ] **Step 3: Thread translations via props through the client components**

`DateFilter` and `PaginatedGamesTable` are client components — they can't call `getTranslations`. Instead:

1. In `page.tsx` files (dashboard + league), call `getTranslations({ locale, namespace: 'app.stats' })` and build a plain `StatsLabels` object:

```ts
// in page.tsx files
import { getTranslations } from 'next-intl/server'

const t = await getTranslations({ locale, namespace: 'app.stats' })
const labels = {
  ranking: t('ranking'),
  rankingSubtitle: t('rankingSubtitle'),
  // ... all 60+ keys
}
```

2. Extract the label mapping into a helper `src/lib/stats/buildStatsLabels.ts`:

```ts
import { getTranslations } from 'next-intl/server'

export type StatsLabels = {
  ranking: string
  rankingSubtitle: string
  rankingMembers: string
  topGames: string
  topGamesSubtitle: string
  playDays: string
  leaguesPanel: string
  leaguesSubtitle: string
  missions: string
  missionsEmpty: string
  gamesFrequency: string
  gamesFrequencyEmpty: string
  headToHead: string
  headToHeadTooMany: string
  headToHeadBest: string
  headToHeadWorst: string
  streaks: string
  recentForm: string
  recentFormNone: string
  scoreRecords: string
  scoreRecordsHighest: string
  scoreRecordsHighestLoss: string
  scoreRecordsAvgWinner: string
  winTrend: string
  winTrendSubtitle: string
  gamesTable: string
  gamesTableWinner: string
  gamesTableEmpty: string
  gamesTableHeaderGame: string
  gamesTableHeaderDate: string
  gamesTableHeaderPlayers: string
  gamesTableHeaderResult: string
  resultWon: string
  resultLost: string
  empty: string
  emptyLeagues: string
  recencyToday: string
  recencyYesterday: string
  recencyOneWeek: string
  recencyNever: string
  prev: string
  next: string
  rangeWeek: string
  rangeMonth: string
  rangeYear: string
  rangeAll: string
  rangeCustom: string
  rangeApply: string
  rangeFrom: string
  rangeTo: string
}

export type StatsFormatters = {
  missionsTop: (count: number) => string
  streaksCurrent: (count: number) => string
  streaksLongest: (count: number) => string
  wins: (count: number) => string
  winRatio: (ratio: number) => string
  playCount: (count: number) => string
  playCountSessies: (count: number) => string
  playerCount: (count: number) => string
  totalPrefix: (count: number) => string
  recencyDays: (count: number) => string
  recencyWeeks: (count: number) => string
  recencyMonths: (count: number) => string
  pagination: (page: number, total: number) => string
  paginationPerPage: (count: number) => string
  gamesTableTotal: (count: number, page: number, totalPages: number) => string
}

export async function buildStatsLabels(locale: 'nl' | 'en'): Promise<{ labels: StatsLabels; formatters: StatsFormatters }> {
  const t = await getTranslations({ locale, namespace: 'app.stats' })
  const labels: StatsLabels = {
    ranking: t('ranking'),
    rankingSubtitle: t('rankingSubtitle'),
    rankingMembers: t('rankingMembers'),
    topGames: t('topGames'),
    topGamesSubtitle: t('topGamesSubtitle'),
    playDays: t('playDays'),
    leaguesPanel: t('leaguesPanel'),
    leaguesSubtitle: t('leaguesSubtitle'),
    missions: t('missions'),
    missionsEmpty: t('missionsEmpty'),
    gamesFrequency: t('gamesFrequency'),
    gamesFrequencyEmpty: t('gamesFrequencyEmpty'),
    headToHead: t('headToHead'),
    headToHeadTooMany: t('headToHeadTooMany'),
    headToHeadBest: t('headToHeadBest'),
    headToHeadWorst: t('headToHeadWorst'),
    streaks: t('streaks'),
    recentForm: t('recentForm'),
    recentFormNone: t('recentFormNone'),
    scoreRecords: t('scoreRecords'),
    scoreRecordsHighest: t('scoreRecordsHighest'),
    scoreRecordsHighestLoss: t('scoreRecordsHighestLoss'),
    scoreRecordsAvgWinner: t('scoreRecordsAvgWinner'),
    winTrend: t('winTrend'),
    winTrendSubtitle: t('winTrendSubtitle'),
    gamesTable: t('gamesTable'),
    gamesTableWinner: t('gamesTableWinner'),
    gamesTableEmpty: t('gamesTableEmpty'),
    gamesTableHeaderGame: t('gamesTableHeaderGame'),
    gamesTableHeaderDate: t('gamesTableHeaderDate'),
    gamesTableHeaderPlayers: t('gamesTableHeaderPlayers'),
    gamesTableHeaderResult: t('gamesTableHeaderResult'),
    resultWon: t('resultWon'),
    resultLost: t('resultLost'),
    empty: t('empty'),
    emptyLeagues: t('emptyLeagues'),
    recencyToday: t('recencyToday'),
    recencyYesterday: t('recencyYesterday'),
    recencyOneWeek: t('recencyOneWeek'),
    recencyNever: t('recencyNever'),
    prev: t('prev'),
    next: t('next'),
    rangeWeek: t('rangeWeek'),
    rangeMonth: t('rangeMonth'),
    rangeYear: t('rangeYear'),
    rangeAll: t('rangeAll'),
    rangeCustom: t('rangeCustom'),
    rangeApply: t('rangeApply'),
    rangeFrom: t('rangeFrom'),
    rangeTo: t('rangeTo'),
  }
  const formatters: StatsFormatters = {
    missionsTop: (count) => t('missionsTop', { count }),
    streaksCurrent: (count) => t('streaksCurrent', { count }),
    streaksLongest: (count) => t('streaksLongest', { count }),
    wins: (count) => t('wins', { count }),
    winRatio: (ratio) => t('winRatio', { ratio }),
    playCount: (count) => t('playCount', { count }),
    playCountSessies: (count) => t('playCountSessies', { count }),
    playerCount: (count) => count === 1 ? t('playerCount', { count }) : t('playerCountPlural', { count }),
    totalPrefix: (count) => t('totalPrefix', { count }),
    recencyDays: (count) => t('recencyDays', { count }),
    recencyWeeks: (count) => t('recencyWeeks', { count }),
    recencyMonths: (count) => t('recencyMonths', { count }),
    pagination: (page, total) => t('pagination', { page, total }),
    paginationPerPage: (count) => t('paginationPerPage', { count }),
    gamesTableTotal: (count, page, totalPages) => t('gamesTableTotal', { count, page, totalPages }),
  }
  return { labels, formatters }
}
```

3. Update `DashboardClient`, `LeagueStatsClient`, `DateFilter`, `PaginatedGamesTable` to accept `labels` and `formatters` as props and replace every hardcoded Dutch string with a lookup. Keep the recency helper localised:

```ts
function recency(iso: string | null, labels: StatsLabels, formatters: StatsFormatters): string {
  if (!iso) return labels.recencyNever
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return labels.recencyToday
  if (days === 1) return labels.recencyYesterday
  if (days < 7) return formatters.recencyDays(days)
  if (days < 14) return labels.recencyOneWeek
  if (days < 31) return formatters.recencyWeeks(Math.floor(days / 7))
  return formatters.recencyMonths(Math.floor(days / 30))
}
```

Pass `labels` and `formatters` through the component tree. Dashboard greeting stays hardcoded per spec.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test"
```

Expected: no production-code errors.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: same pre-existing failure count as before work started (14 failures). All new stats tests pass.

- [ ] **Step 6: Build check**

```bash
npx next build 2>&1 | tail -25
```

Expected: build succeeds. Pay attention to any "invalid hook call" warnings (Recharts + SSR issues).

- [ ] **Step 7: Manual smoke on both routes**

```bash
npm run dev
```

Verify in a browser:
- `/app/dashboard` → 6 panels render, date filter works (try each preset + custom), page changes update URL, skeleton appears on hard reload, UI is in Dutch when `locale=nl` and English when `locale=en`
- `/app/leagues/<id>` → header + pending-approval still work, 9 panels render with hide rules observed, head-to-head grid on desktop / per-player list on mobile, win trend chart renders for ≥3 games, games table two-line rows with scores inline
- Log a new game → stats update immediately (no 5-minute stale window)

- [ ] **Step 8: Update INDEX.md**

Phase is already listed as **9** with status "ready to execute". Change status to `done`:

```markdown
| **9** | [stats-panels-expansion.md](2026-04-23-stats-panels-expansion.md) | done | League stats + dashboard expansion + shared primitives + date filter + skeletons + charts + i18n sweep |
```

(Parked payments phases are renumbered to **10a** / **10b**.)

- [ ] **Step 9: Commit and push**

```bash
git add messages/nl/app.json messages/en/app.json src/lib/stats/buildStatsLabels.ts src/components/stats/ src/app/app/dashboard/ src/app/app/leagues/ docs/superpowers/plans/INDEX.md
git commit -m "feat(stats): i18n sweep + wire translations through all panels + mark phase done"
git push origin main
```

Coolify auto-deploys on push.
