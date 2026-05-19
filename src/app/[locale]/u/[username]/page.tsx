import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getTranslations } from 'next-intl/server'
import { canViewPublicProfile, shouldRenderGames } from '@/lib/social/privacy'
import { loadPublicFeed } from '@/lib/social/loadFeed'
import { computeTopThreeTemplates } from '@/lib/social/trophyShelf'
import { PublicProfileHero } from '@/components/social/PublicProfileHero'
import { TrophyShelf } from '@/components/social/TrophyShelf'
import { Scorecard } from '@/components/social/Scorecard'

type Props = {
  params: Promise<{ locale: 'nl' | 'en'; username: string }>
}

export default async function PublicProfilePage({ params }: Props) {
  const { locale, username } = await params
  const t = await getTranslations({ locale, namespace: 'app.social' })

  const profile = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      publicProfileMode: true,
      allowAppearInOthers: true,
    },
  })
  if (!profile || !profile.username || !canViewPublicProfile(profile)) notFound()

  const session = await auth()
  const viewerId = session?.user.id

  const [scoreRows, feed] = await Promise.all([
    prisma.scoreEntry.findMany({
      where: {
        player: {
          OR: [
            { linkedUserId: profile.id },
            { userId: profile.id, linkedUserId: null },
          ],
        },
        playedGame: { status: 'approved' },
      },
      select: {
        isWinner: true,
        playedGame: {
          select: { league: { select: { gameTemplate: { select: { id: true, name: true, color: true, icon: true } } } } },
        },
      },
    }),
    shouldRenderGames(profile)
      ? loadPublicFeed(profile.id, 1, 10, viewerId)
      : Promise.resolve(null),
  ])

  const gamesCount = scoreRows.length
  const winsCount = scoreRows.filter(r => r.isWinner).length
  const winRate = gamesCount === 0 ? 0 : winsCount / gamesCount

  const trophies = computeTopThreeTemplates(scoreRows.map(r => ({
    templateId: r.playedGame.league.gameTemplate.id,
    name: r.playedGame.league.gameTemplate.name,
    color: r.playedGame.league.gameTemplate.color,
    icon: r.playedGame.league.gameTemplate.icon,
    isWinner: r.isWinner,
  })))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <PublicProfileHero
        username={profile.username}
        avatarSeed={profile.username}
        gamesCount={gamesCount}
        winsCount={winsCount}
        winRate={winRate}
      />
      <TrophyShelf entries={trophies} heading={t('trophyShelfHeading')} />
      {feed && (
        <section style={{ marginTop: 24 }}>
          <h2
            style={{
              fontFamily: 'var(--font-headline)', fontWeight: 700,
              fontSize: 13, color: '#9a8878', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 12,
            }}
          >
            {t('publicGamesHeading')}
          </h2>
          <div className="space-y-3">
            {feed.games.map(g => (
              <Scorecard key={g.id} game={g} canReact={false} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
