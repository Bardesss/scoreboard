# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dashboard (3 stat pills + leaderboard top 5 + recent 5 games) with four ranked-list panels (top-10 ranking, top-10 games, all 7 play days, all leagues) and a full paginated played-games table (25/page).

**Architecture:** `page.tsx` is a server component that reads `?page=N` from `searchParams`, loads stats (Redis-cached 5 min) and a paginated games slice in parallel, then passes everything as props to `DashboardClient.tsx` (a server component that renders the four panels and the games table). Pagination uses plain `<Link href="?page=N">` — no client-side state.

**Tech Stack:** Next.js 15 App Router · Prisma 5 · ioredis · next/link · existing Avatar component

---

## File Map

**Modified:**
- `src/app/app/dashboard/page.tsx` — replace `loadStats` with `loadDashboardStats` + `loadPlayedGames`, update page component to read `searchParams.page` and render `DashboardClient`

**Created:**
- `src/app/app/dashboard/DashboardClient.tsx` — server component rendering all four panels + games table + pagination

**Modified:**
- `messages/nl/app.json` — update `dashboard` keys
- `messages/en/app.json` — update `dashboard` keys

---

## Task 1: Rewrite `page.tsx` — new types and data loading

**Files:**
- Modify: `src/app/app/dashboard/page.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/app/dashboard/page.tsx
```

- [ ] **Step 2: Replace the entire file**

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RankingEntry = {
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
  day: number   // 0 = Sun, 1 = Mon, …, 6 = Sat
  label: string // Dutch day name
  count: number
}

export type LeagueStat = {
  id: string
  name: string
  playerCount: number
  sessionCount: number
  lastPlayedAt: string | null
}

export type DashboardStats = {
  ranking: RankingEntry[]
  topGames: TopGame[]
  playDays: PlayDay[]
  leagues: LeagueStat[]
}

export type GameRow = {
  id: string
  gameName: string
  leagueName: string
  playedAt: string
  playerNames: string[]
  userWon: boolean | null  // null = user has no player in this game
}

export type GamesPage = {
  games: GameRow[]
  total: number
  page: number
  totalPages: number
}

// ─── Data loading ─────────────────────────────────────────────────────────────

const DAY_LABELS_NL = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

async function loadDashboardStats(userId: string): Promise<DashboardStats> {
  const cacheKey = `cache:dashboard:stats:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as DashboardStats

  // Current user's player IDs (for highlighting + win ratio per game)
  const userPlayerIds = await prisma.player
    .findMany({ where: { userId }, select: { id: true } })
    .then(ps => new Set(ps.map(p => p.id)))

  // All approved played games in leagues this user owns
  const playedGames = await prisma.playedGame.findMany({
    where: { league: { ownerId: userId }, status: 'approved' },
    include: {
      league: { select: { id: true, gameTemplate: { select: { name: true } } } },
      scores: {
        include: { player: { select: { id: true, name: true, avatarSeed: true, userId: true } } },
        orderBy: { score: 'desc' },
      },
    },
  })

  // ── Ranking ──────────────────────────────────────────────────────────────
  const playerMap: Record<string, {
    name: string; avatarSeed: string; userId: string
    wins: number; gamesPlayed: number
  }> = {}

  for (const pg of playedGames) {
    for (const s of pg.scores) {
      const pid = s.player.id
      if (!playerMap[pid]) {
        playerMap[pid] = { name: s.player.name, avatarSeed: s.player.avatarSeed, userId: s.player.userId, wins: 0, gamesPlayed: 0 }
      }
      playerMap[pid].gamesPlayed++
    }
    const winner = pg.scores[0]
    if (winner) playerMap[winner.player.id].wins++
  }

  const ranking: RankingEntry[] = Object.entries(playerMap)
    .map(([id, p]) => ({
      name: p.name,
      avatarSeed: p.avatarSeed,
      wins: p.wins,
      gamesPlayed: p.gamesPlayed,
      winRatio: p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0,
      isCurrentUser: userPlayerIds.has(id),
    }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10)

  // ── Top games ─────────────────────────────────────────────────────────────
  const gameMap: Record<string, { count: number; userWins: number; userGames: number }> = {}

  for (const pg of playedGames) {
    const name = pg.league.gameTemplate.name
    if (!gameMap[name]) gameMap[name] = { count: 0, userWins: 0, userGames: 0 }
    gameMap[name].count++
    const winner = pg.scores[0]
    for (const s of pg.scores) {
      if (userPlayerIds.has(s.player.id)) {
        gameMap[name].userGames++
        if (winner && s.player.id === winner.player.id) gameMap[name].userWins++
      }
    }
  }

  const topGames: TopGame[] = Object.entries(gameMap)
    .map(([name, g]) => ({
      name,
      count: g.count,
      userWinRatio: g.userGames > 0 ? Math.round((g.userWins / g.userGames) * 100) : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // ── Play days ─────────────────────────────────────────────────────────────
  const dayCounts = new Array(7).fill(0) as number[]
  for (const pg of playedGames) {
    dayCounts[new Date(pg.playedAt).getDay()]++
  }
  const playDays: PlayDay[] = dayCounts
    .map((count, day) => ({ day, label: DAY_LABELS_NL[day], count }))
    .sort((a, b) => b.count - a.count)

  // ── Leagues ───────────────────────────────────────────────────────────────
  const leagueSessionCounts: Record<string, number> = {}
  const leagueLastPlayed: Record<string, string> = {}
  for (const pg of playedGames) {
    leagueSessionCounts[pg.league.id] = (leagueSessionCounts[pg.league.id] ?? 0) + 1
    const iso = pg.playedAt.toISOString()
    if (!leagueLastPlayed[pg.league.id] || iso > leagueLastPlayed[pg.league.id]) {
      leagueLastPlayed[pg.league.id] = iso
    }
  }

  const allLeagues = await prisma.league.findMany({
    where: { ownerId: userId },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const leagues: LeagueStat[] = allLeagues
    .map(l => ({
      id: l.id,
      name: l.name,
      playerCount: l._count.members,
      sessionCount: leagueSessionCounts[l.id] ?? 0,
      lastPlayedAt: leagueLastPlayed[l.id] ?? null,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)

  const stats: DashboardStats = { ranking, topGames, playDays, leagues }
  await redis.setex(cacheKey, 300, JSON.stringify(stats))
  return stats
}

async function loadPlayedGames(userId: string, page: number, perPage: number): Promise<GamesPage> {
  const where = { league: { ownerId: userId }, status: 'approved' as const }

  const [userPlayerIds, total, rows] = await Promise.all([
    prisma.player
      .findMany({ where: { userId }, select: { id: true } })
      .then(ps => new Set(ps.map(p => p.id))),
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

  const games: GameRow[] = rows.map(pg => {
    const winner = pg.scores[0]
    const userInGame = pg.scores.some(s => userPlayerIds.has(s.player.id))
    return {
      id: pg.id,
      gameName: pg.league.gameTemplate.name,
      leagueName: pg.league.name,
      playedAt: pg.playedAt.toISOString(),
      playerNames: pg.scores.map(s => s.player.name),
      userWon: userInGame
        ? (winner != null && userPlayerIds.has(winner.player.id))
        : null,
    }
  })

  return { games, total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = { searchParams: Promise<{ page?: string }> }

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  const [stats, gamesPage] = await Promise.all([
    loadDashboardStats(session.user.id),
    loadPlayedGames(session.user.id, page, 25),
  ])

  const firstName = session.user.name?.split(' ')[0] ?? ''

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div style={{ marginBottom: 24 }}>
        <h1
          className="font-headline"
          style={{ fontSize: 22, fontWeight: 700, color: '#1e1a14', letterSpacing: '-0.02em' }}
        >
          Goedemiddag, {firstName} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#6b5e4a', marginTop: 2 }}>Hier is je overzicht</p>
      </div>
      <DashboardClient stats={stats} gamesPage={gamesPage} />
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/page"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/dashboard/page.tsx
git commit -m "feat(dashboard): new data loading — ranking, top games, play days, leagues, paginated games"
```

---

## Task 2: Create `DashboardClient.tsx`

**Files:**
- Create: `src/app/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create the file**

```typescript
import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import type { DashboardStats, GamesPage } from './page'

// ─── Shared styles ────────────────────────────────────────────────────────────

const card = {
  background: '#fefcf8',
  border: '1px solid #c5b89f',
  borderRadius: 16,
  overflow: 'hidden' as const,
}

const cardHeader = {
  padding: '14px 18px',
  borderBottom: '1px solid #ede5d8',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
}

const cardTitle = {
  fontSize: 14,
  fontWeight: 700,
  color: '#1e1a14',
  fontFamily: 'var(--font-headline)',
}

const labelStyle = {
  fontSize: 11,
  color: '#6b5e4a',
}

// ─── Ranking panel ────────────────────────────────────────────────────────────

function RankingPanel({ ranking }: { ranking: DashboardStats['ranking'] }) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>🏆 Ranking</span>
        <span style={labelStyle}>alle leagues</span>
      </div>
      <div style={{ padding: '0 18px' }}>
        {ranking.map((p, i) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < ranking.length - 1 ? '1px solid #f2ece3' : undefined,
              ...(p.isCurrentUser
                ? { background: 'rgba(245,166,35,0.07)', margin: '0 -18px', padding: '8px 18px' }
                : {}),
            }}
          >
            <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: i < 3 ? '#f5a623' : '#9a8c7a', flexShrink: 0 }}>
              {i + 1}
            </span>
            <Avatar seed={p.avatarSeed} name={p.name} size={24} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: p.isCurrentUser ? 700 : 400, color: '#1e1a14', marginLeft: 8 }}>
              {p.name}
            </span>
            <span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>{p.wins} wins</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14' }}>{p.winRatio}%</span>
          </div>
        ))}
        {ranking.length === 0 && (
          <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>
        )}
      </div>
    </div>
  )
}

// ─── Top games panel ──────────────────────────────────────────────────────────

function TopGamesPanel({ topGames }: { topGames: DashboardStats['topGames'] }) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>🎲 Top spellen</span>
        <span style={labelStyle}>meest gespeeld</span>
      </div>
      <div style={{ padding: '0 18px' }}>
        {topGames.map((g, i) => (
          <div
            key={g.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < topGames.length - 1 ? '1px solid #f2ece3' : undefined,
            }}
          >
            <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: i < 3 ? '#f5a623' : '#9a8c7a', flexShrink: 0 }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, fontSize: 13, color: '#1e1a14' }}>{g.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14', marginRight: 10 }}>{g.count}×</span>
            <span style={{ fontSize: 12, color: '#6b5e4a' }}>
              {g.userWinRatio !== null ? `${g.userWinRatio}% wr` : '—'}
            </span>
          </div>
        ))}
        {topGames.length === 0 && (
          <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>
        )}
      </div>
    </div>
  )
}

// ─── Play days panel ──────────────────────────────────────────────────────────

function PlayDaysPanel({ playDays }: { playDays: DashboardStats['playDays'] }) {
  const max = Math.max(...playDays.map(d => d.count), 1)
  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>📅 Speeldagen</span>
      </div>
      <div style={{ padding: '16px 18px' }}>
        {playDays.map((d, i) => (
          <div key={d.day} style={{ marginBottom: i < playDays.length - 1 ? 11 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400, color: d.count === 0 ? '#9a8c7a' : '#1e1a14' }}>
                {d.label}{i === 0 && d.count > 0 ? ' 🔥' : ''}
              </span>
              <span style={{ fontSize: 12, color: d.count === 0 ? '#9a8c7a' : '#6b5e4a' }}>{d.count} sessies</span>
            </div>
            <div style={{ background: '#ede5d8', borderRadius: 4, height: 7 }}>
              <div
                style={{
                  background: i === 0 && d.count > 0 ? '#f5a623' : d.count === 0 ? '#dbd0bc' : '#c5b89f',
                  borderRadius: 4,
                  height: 7,
                  width: `${Math.round((d.count / max) * 100)}%`,
                  minWidth: d.count > 0 ? 4 : 0,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Leagues panel ────────────────────────────────────────────────────────────

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
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>🏅 Leagues</span>
        <span style={labelStyle}>meest actief</span>
      </div>
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
        {leagues.length === 0 && (
          <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen leagues aangemaakt.</p>
        )}
      </div>
    </div>
  )
}

// ─── Games table ─────────────────────────────────────────────────────────────

function GamesTable({ gamesPage }: { gamesPage: GamesPage }) {
  const { games, page, totalPages, total } = gamesPage

  return (
    <div style={card}>
      <div style={{ ...cardHeader, padding: '14px 20px' }}>
        <span style={cardTitle}>Gespeelde partijen</span>
        <span style={labelStyle}>{total} totaal · pagina {page} van {totalPages}</span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 140px 90px',
          padding: '7px 20px',
          background: '#f2ece3',
        }}
      >
        {['Spel · League', 'Datum', 'Spelers', 'Uitslag'].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b5e4a' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {games.map((g, i) => (
        <div
          key={g.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 140px 90px',
            padding: '11px 20px',
            borderBottom: i < games.length - 1 ? '1px solid #f2ece3' : undefined,
            background: g.userWon === true ? 'rgba(245,166,35,0.04)' : undefined,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1a14' }}>{g.gameName}</div>
            <div style={{ fontSize: 11, color: '#6b5e4a' }}>{g.leagueName}</div>
          </div>
          <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>
            {new Date(g.playedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>
            {g.playerNames.join(', ')}
          </div>
          <div style={{ paddingTop: 1 }}>
            {g.userWon === true && (
              <span style={{ background: '#fff3d4', color: '#c27f0a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                Gewonnen
              </span>
            )}
            {g.userWon === false && (
              <span style={{ background: '#f2ece3', color: '#6b5e4a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                Verloren
              </span>
            )}
          </div>
        </div>
      ))}

      {games.length === 0 && (
        <p style={{ fontSize: 13, color: '#9a8c7a', padding: '20px', textAlign: 'center' }}>
          Nog geen partijen gespeeld.
        </p>
      )}

      {/* Pagination */}
      <div
        style={{
          padding: '11px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #ede5d8',
          background: '#f2ece3',
        }}
      >
        <span style={{ fontSize: 12, color: '#6b5e4a' }}>Pagina {page} van {totalPages} · 25 per pagina</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {page > 1 ? (
            <Link
              href={`?page=${page - 1}`}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', color: '#1e1a14', fontSize: 12, textDecoration: 'none' }}
            >
              ← Vorige
            </Link>
          ) : (
            <span style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', color: '#9a8c7a', fontSize: 12, opacity: 0.4 }}>
              ← Vorige
            </span>
          )}
          {page < totalPages ? (
            <Link
              href={`?page=${page + 1}`}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #f5a623', background: '#fff3d4', color: '#c27f0a', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              Volgende →
            </Link>
          ) : (
            <span style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', color: '#9a8c7a', fontSize: 12, opacity: 0.4 }}>
              Volgende →
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  stats,
  gamesPage,
}: {
  stats: DashboardStats
  gamesPage: GamesPage
}) {
  return (
    <>
      {/* 2×2 panel grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
        className="sm:grid-cols-2 grid-cols-1"
      >
        <RankingPanel ranking={stats.ranking} />
        <TopGamesPanel topGames={stats.topGames} />
        <PlayDaysPanel playDays={stats.playDays} />
        <LeaguesPanel leagues={stats.leagues} />
      </div>

      {/* Paginated games table */}
      <GamesTable gamesPage={gamesPage} />
    </>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): DashboardClient — 4 ranked panels and paginated games table"
```

---

## Task 3: Update translations, run checks, push

**Files:**
- Modify: `messages/nl/app.json`
- Modify: `messages/en/app.json`

- [ ] **Step 1: Read current nl/app.json dashboard section**

```bash
node -e "const d=require('./messages/nl/app.json'); console.log(JSON.stringify(d.dashboard, null, 2))"
```

- [ ] **Step 2: Update `messages/nl/app.json`**

Replace the `dashboard` key in `messages/nl/app.json`. The file is JSON — load it, set `data.dashboard`, write it back. The new value:

```json
{
  "title": "Dashboard",
  "empty": "Nog geen potjes gelogd. Maak een competitie en log je eerste spel!"
}
```

(Remove the old keys `totalGames`, `totalPlayers`, `topGame`, `leaderboard`, `recentGames`, `wins`, `winRatio` — they are no longer used in the dashboard page. Keep only `title` and `empty`.)

- [ ] **Step 3: Update `messages/en/app.json`**

Same update for English — replace `dashboard` section with:

```json
{
  "title": "Dashboard",
  "empty": "No games logged yet. Create a league and log your first game!"
}
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: same pass/fail ratio as before this feature (14 pre-existing failures, everything else passes).

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "^src/test\|^src/lib/credits.test"
```

Expected: no output.

- [ ] **Step 6: Update INDEX.md**

Add a row in `docs/superpowers/plans/INDEX.md`:

```markdown
| **Dashboard redesign** | [dashboard-redesign.md](2026-04-22-dashboard-redesign.md) | ready to execute | Dashboard panels + paginated games list |
```

- [ ] **Step 7: Commit and push**

```bash
git add messages/nl/app.json messages/en/app.json docs/superpowers/plans/INDEX.md
git commit -m "feat(dashboard): update translations, mark plan ready"
git push origin main
```
