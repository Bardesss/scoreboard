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

  // Current user's OWN player IDs (linkedUserId points to them). Not all vault players.
  const userPlayerIds = await prisma.player
    .findMany({ where: { linkedUserId: userId }, select: { id: true } })
    .then(ps => new Set(ps.map(p => p.id)))

  // All approved played games in leagues this user owns
  const playedGames = await prisma.playedGame.findMany({
    where: { league: { ownerId: userId }, status: 'approved' },
    include: {
      league: { select: { id: true, gameTemplate: { select: { name: true } } } },
      scores: {
        select: {
          playerId: true,
          score: true,
          isWinner: true,
          player: { select: { id: true, name: true, avatarSeed: true, userId: true } },
        },
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
    for (const s of pg.scores) {
      if (s.isWinner && playerMap[s.player.id]) playerMap[s.player.id].wins++
    }
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
    for (const s of pg.scores) {
      if (userPlayerIds.has(s.player.id)) {
        gameMap[name].userGames++
        if (s.isWinner) gameMap[name].userWins++
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
      .findMany({ where: { linkedUserId: userId }, select: { id: true } })
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
          select: {
            playerId: true,
            score: true,
            isWinner: true,
            player: { select: { id: true, name: true } },
          },
          orderBy: { score: 'desc' },
        },
      },
    }),
  ])

  const games: GameRow[] = rows.map(pg => {
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

  const [stats, gamesPage, user, mePlayer] = await Promise.all([
    loadDashboardStats(session.user.id),
    loadPlayedGames(session.user.id, page, 25),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true, email: true } }),
    prisma.player.findFirst({ where: { linkedUserId: session.user.id }, select: { name: true } }),
  ])

  const displayName = mePlayer?.name ?? user?.username ?? user?.email?.split('@')[0] ?? ''

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
      <DashboardClient stats={stats} gamesPage={gamesPage} />
    </div>
  )
}
