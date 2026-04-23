import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Trophy, Plus } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { ShareButton } from './ShareButton'
import { PendingApprovalSection } from './PendingApprovalSection'
import { SessionActions } from './SessionActions'
import { formatTime } from '@/lib/game-logic/formatTime'

export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const [league, pendingGames, t] = await Promise.all([
    prisma.league.findUnique({
      where: { id },
      include: {
        gameTemplate: { select: { name: true, scoringNotes: true, winType: true, winCondition: true, timeUnit: true } },
        members: {
          include: { player: { select: { id: true, name: true, avatarSeed: true } } },
          orderBy: { createdAt: 'asc' },
        },
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
      },
    }),
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
    getTranslations({ locale, namespace: 'app.leagues' }),
  ])

  if (!league || league.ownerId !== session.user.id) notFound()

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
  const sortedMembers = [...membersWithStats].sort((a, b) => (b.winRatio ?? -1) - (a.winRatio ?? -1))

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      {/* Header */}
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
          <Plus size={16} /> {t('logGame')}
        </Link>
      </div>

      {/* Members */}
      <section className="mb-8">
        <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{t('members')}</h2>
        <div className="flex flex-wrap gap-2">
          {sortedMembers.map(m => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: '#f0ebe3' }}>
              <Avatar seed={m.player.avatarSeed} name={m.player.name} size={22} />
              <span className="font-headline font-semibold text-xs" style={{ color: '#1c1810' }}>{m.player.name}</span>
              {m.winRatio !== null && (
                <span className="font-headline font-bold text-xs" style={{ color: '#9a8878' }}>
                  {t('winsStats', { wins: m.wins, games: m.gamesPlayed, ratio: m.winRatio })}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pending approval */}
      <PendingApprovalSection
        games={pendingGames.map(pg => ({
          id: pg.id,
          playedAt: pg.playedAt.toISOString(),
          submittedByEmail: pg.submittedBy.email,
          scores: pg.scores.map(s => ({ playerName: s.player.name, score: s.score })),
        }))}
      />

      {/* Played games */}
      <section>
        <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{t('playedGames')}</h2>
        {league.playedGames.length === 0 ? (
          <p className="text-sm font-body py-8 text-center" style={{ color: '#9a8878' }}>{t('noGames')}</p>
        ) : (
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
                        league.gameTemplate.winCondition === 'high' ? b.score - a.score : a.score - b.score
                      )).map((s, i) => (
                        <li key={s.id} className="flex justify-between text-xs font-body">
                          <span style={{ color: s.isWinner ? '#f5a623' : '#4a3f2f' }}>
                            #{i + 1} {s.player.name}
                          </span>
                          <span style={{ color: '#9a8878' }}>{formatTime(s.score, league.gameTemplate.timeUnit as 'seconds' | 'minutes' | 'mmss' | null)}</span>
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
                      {pg.scores.slice().sort((a, b) => (b.eliminationOrder ?? Infinity) - (a.eliminationOrder ?? Infinity)).map(s => (
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
        )}
      </section>
    </div>
  )
}
