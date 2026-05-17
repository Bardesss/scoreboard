import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { loadStats } from '@/lib/stats/loadStats'
import { loadGames } from '@/lib/stats/loadGames'
import { parseRange } from '@/lib/stats/dateRange'
import { buildStatsLabels } from '@/lib/stats/buildStatsLabels'
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
  const locale = (session.user.locale === 'en' ? 'en' : 'nl') as 'nl' | 'en'

  const scope = { kind: 'league' as const, leagueId: id, viewerId: session.user.id }

  const [league, stats, gamesPage, pendingGames, i18n, tPlayedGames] = await Promise.all([
    prisma.league.findUnique({
      where: { id },
      include: {
        gameTemplate: { select: { name: true, color: true, icon: true } },
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
    buildStatsLabels(locale),
    getTranslations({ locale, namespace: 'app.playedGames' }),
  ])
  const { labels, formatters } = i18n

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
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${league.gameTemplate.color}22` }}>
          {league.gameTemplate.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-headline font-black text-2xl break-words" style={{ color: '#1e1a14' }}>{league.name}</h1>
          <p className="text-sm font-body" style={{ color: '#9a8878' }}>{league.gameTemplate.name}</p>
        </div>
        <Link
          href={`/app/leagues/${id}/log`}
          aria-label={tPlayedGames('log')}
          title={tPlayedGames('log')}
          className="flex items-center justify-center gap-2 rounded-xl font-headline font-bold text-sm flex-shrink-0 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{tPlayedGames('log')}</span>
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
        labels={labels}
        formatters={formatters}
      />
    </div>
  )
}
