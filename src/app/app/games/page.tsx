import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import GamesClient from './GamesClient'

export default async function GamesPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const [templates, borrowedMemberships, t] = await Promise.all([
    prisma.gameTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.leagueMember.findMany({
      where: {
        player: { userId: session.user.id },
        league: { ownerId: { not: session.user.id } },
      },
      include: {
        league: {
          include: {
            gameTemplate: { select: { id: true, name: true, color: true, icon: true, winType: true } },
            owner: { select: { username: true, email: true } },
          },
        },
      },
    }),
    getTranslations({ locale, namespace: 'app.games' }),
  ])

  const seenTemplateIds = new Set(templates.map(t => t.id))
  const borrowedTemplates: Array<{
    id: string; name: string; color: string; icon: string; winType: string; ownerName: string
  }> = []
  for (const membership of borrowedMemberships) {
    const tmpl = membership.league.gameTemplate
    if (!seenTemplateIds.has(tmpl.id)) {
      seenTemplateIds.add(tmpl.id)
      borrowedTemplates.push({
        ...tmpl,
        ownerName: membership.league.owner.username ?? membership.league.owner.email,
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>
        <Link
          href="/app/games/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} /> {t('add')}
        </Link>
      </div>

      <GamesClient
        templates={templates.map(tmpl => ({
          id: tmpl.id,
          name: tmpl.name,
          description: tmpl.description,
          color: tmpl.color,
          icon: tmpl.icon,
          winType: tmpl.winType,
          minPlayers: tmpl.minPlayers,
          maxPlayers: tmpl.maxPlayers,
          scoringNotes: tmpl.scoringNotes,
        }))}
        borrowedTemplates={borrowedTemplates}
      />
    </div>
  )
}
