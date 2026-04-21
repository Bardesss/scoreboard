import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Plus, Trophy } from 'lucide-react'
import { VaultRibbon } from '@/components/shared/VaultRibbon'

export default async function LeaguesPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const [ownLeagues, borrowedLeagues, t] = await Promise.all([
    prisma.league.findMany({
      where: { ownerId: session.user.id },
      include: {
        gameTemplate: { select: { name: true, color: true, icon: true } },
        _count: { select: { members: true, playedGames: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.league.findMany({
      where: {
        ownerId: { not: session.user.id },
        members: { some: { player: { userId: session.user.id } } },
      },
      include: {
        gameTemplate: { select: { name: true, color: true, icon: true } },
        owner: { select: { username: true, email: true } },
        _count: { select: { members: true, playedGames: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getTranslations({ locale, namespace: 'app.leagues' }),
  ])

  const allEmpty = ownLeagues.length === 0 && borrowedLeagues.length === 0

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>
        <Link
          href="/app/leagues/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} /> {t('add')}
        </Link>
      </div>

      {allEmpty ? (
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {ownLeagues.map(league => (
            <li key={league.id}>
              <Link
                href={`/app/leagues/${league.id}`}
                className="block p-4 rounded-2xl transition-colors"
                style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                    <Trophy size={18} style={{ color: '#f5a623' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{league.name}</div>
                    <div className="text-xs font-body mt-0.5" style={{ color: '#9a8878' }}>
                      {league.gameTemplate.name} · {league._count.members} {t('members')} · {league._count.playedGames} {t('playedGames')}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
          {borrowedLeagues.map(league => (
            <li key={league.id}>
              <div className="relative">
                <VaultRibbon ownerName={league.owner.username ?? league.owner.email} />
                <Link
                  href={`/app/leagues/${league.id}`}
                  className="block p-4 rounded-2xl transition-colors"
                  style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                      <Trophy size={18} style={{ color: '#f5a623' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{league.name}</div>
                      <div className="text-xs font-body mt-0.5" style={{ color: '#9a8878' }}>
                        {league.gameTemplate.name} · {league._count.members} {t('members')} · {league._count.playedGames} {t('playedGames')}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
