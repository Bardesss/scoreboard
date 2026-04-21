import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Trophy, Users, Dices, ClipboardList } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'

type DashboardStats = {
  totalGames: number
  totalPlayers: number
  topGame: string | null
  leaderboard: { name: string; avatarSeed: string; wins: number }[]
  recentGames: {
    id: string
    leagueName: string
    gameName: string
    playedAt: string
    scores: { playerName: string; score: number }[]
  }[]
}

async function loadStats(userId: string): Promise<DashboardStats> {
  const cacheKey = `cache:dashboard:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as DashboardStats

  const [playedGames, players] = await Promise.all([
    prisma.playedGame.findMany({
      where: { league: { ownerId: userId }, status: 'approved' },
      include: {
        league: { select: { name: true, gameTemplate: { select: { name: true } } } },
        scores: { include: { player: { select: { name: true, avatarSeed: true } } }, orderBy: { score: 'desc' } },
      },
      orderBy: { playedAt: 'desc' },
    }),
    prisma.player.findMany({ where: { userId } }),
  ])

  const totalGames = playedGames.length
  const totalPlayers = players.length

  const gameCounts: Record<string, number> = {}
  for (const pg of playedGames) {
    const name = pg.league.gameTemplate.name
    gameCounts[name] = (gameCounts[name] ?? 0) + 1
  }
  const topGame = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const winCounts: Record<string, { name: string; avatarSeed: string; wins: number }> = {}
  for (const pg of playedGames) {
    const winner = pg.scores[0]
    if (!winner) continue
    const key = winner.player.name
    if (!winCounts[key]) winCounts[key] = { name: winner.player.name, avatarSeed: winner.player.avatarSeed, wins: 0 }
    winCounts[key].wins++
  }
  const leaderboard = Object.values(winCounts).sort((a, b) => b.wins - a.wins).slice(0, 5)

  const recentGames = playedGames.slice(0, 5).map(pg => ({
    id: pg.id,
    leagueName: pg.league.name,
    gameName: pg.league.gameTemplate.name,
    playedAt: pg.playedAt.toISOString(),
    scores: pg.scores.map(s => ({ playerName: s.player.name, score: s.score })),
  }))

  const stats: DashboardStats = { totalGames, totalPlayers, topGame, leaderboard, recentGames }
  await redis.setex(cacheKey, 300, JSON.stringify(stats))
  return stats
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const [stats, t] = await Promise.all([
    loadStats(session.user.id),
    getTranslations({ locale: session.user.locale ?? 'en', namespace: 'app.dashboard' }),
  ])

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <h1 className="font-headline font-black text-2xl mb-6" style={{ color: '#1c1810' }}>{t('title')}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {[
          { icon: ClipboardList, label: t('totalGames'), value: stats.totalGames },
          { icon: Users,         label: t('totalPlayers'), value: stats.totalPlayers },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
            <card.icon size={18} style={{ color: '#f5a623' }} />
            <div className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{card.value}</div>
            <div className="font-body text-xs" style={{ color: '#9a8878' }}>{card.label}</div>
          </div>
        ))}
        {stats.topGame && (
          <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
            <Dices size={18} style={{ color: '#f5a623' }} />
            <div className="font-headline font-bold text-sm leading-snug" style={{ color: '#1c1810' }}>{stats.topGame}</div>
            <div className="font-body text-xs" style={{ color: '#9a8878' }}>{t('topGame')}</div>
          </div>
        )}
      </div>

      {stats.leaderboard.length > 0 && (
        <section className="mb-8">
          <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{t('leaderboard')}</h2>
          <ul className="space-y-2">
            {stats.leaderboard.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <span className="font-headline font-black text-sm w-5" style={{ color: i === 0 ? '#f5a623' : '#c4b79a' }}>#{i + 1}</span>
                <Avatar seed={p.avatarSeed} name={p.name} size={28} />
                <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{p.name}</span>
                <span className="font-headline font-bold text-xs" style={{ color: '#9a8878' }}>{t('wins', { count: p.wins })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.recentGames.length > 0 && (
        <section>
          <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{t('recentGames')}</h2>
          <ul className="space-y-3">
            {stats.recentGames.map(pg => (
              <li key={pg.id} className="p-4 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{pg.leagueName}</span>
                  <span className="font-body text-xs" style={{ color: '#9a8878' }}>
                    {new Date(pg.playedAt).toLocaleDateString()}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {pg.scores.map((s, i) => (
                    <li key={i} className="flex justify-between text-xs font-body">
                      <span style={{ color: i === 0 ? '#f5a623' : '#4a3f2f' }}>{s.playerName}</span>
                      <span style={{ color: '#9a8878' }}>{s.score}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.totalGames === 0 && (
        <p className="text-center font-body text-sm py-12" style={{ color: '#9a8878' }}>{t('empty')}</p>
      )}
    </div>
  )
}
