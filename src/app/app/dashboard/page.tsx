import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import DashboardClient from './DashboardClient'
import { loadStats } from '@/lib/stats/loadStats'
import { loadGames } from '@/lib/stats/loadGames'
import { parseRange } from '@/lib/stats/dateRange'
import { buildStatsLabels } from '@/lib/stats/buildStatsLabels'
import { PageHeader } from '@/components/shared/PageHeader'

type PageProps = {
  searchParams: Promise<{ range?: string; from?: string; to?: string; page?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const sp = await searchParams
  const filter = parseRange(sp)
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  // session.user.locale exists on the User model (set in auth.ts).
  // Fall back to 'nl' since the dashboard greeting copy is currently Dutch.
  const locale = (session.user.locale === 'en' ? 'en' : 'nl') as 'nl' | 'en'

  const scope = { kind: 'user' as const, userId: session.user.id }

  const [stats, gamesPage, user, mePlayer, i18n, tDashboard] = await Promise.all([
    loadStats(scope, filter, locale),
    loadGames(scope, filter, page, 25, 'compact'),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true, email: true } }),
    prisma.player.findFirst({ where: { linkedUserId: session.user.id }, select: { name: true } }),
    buildStatsLabels(locale),
    getTranslations({ locale, namespace: 'app.dashboard' }),
  ])
  const { labels, formatters } = i18n

  // Greeting prefers the "me" player's name (e99f961), then username (b820d3f), then email local-part.
  const displayName = mePlayer?.name ?? user?.username ?? user?.email?.split('@')[0] ?? ''

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <PageHeader title={tDashboard('greeting', { name: displayName })} subtitle={tDashboard('subtitle')} />
      <DashboardClient stats={stats} gamesPage={gamesPage} filter={filter} locale={locale} labels={labels} formatters={formatters} />
    </div>
  )
}
