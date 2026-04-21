import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { VaultRibbon } from '@/components/shared/VaultRibbon'

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

  // Deduplicate borrowed templates by template id, keeping the first occurrence
  const seenTemplateIds = new Set(templates.map(t => t.id))
  const borrowedTemplates: Array<{
    id: string
    name: string
    color: string
    icon: string
    winType: string
    ownerName: string
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

  const allEmpty = templates.length === 0 && borrowedTemplates.length === 0

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

      {allEmpty ? (
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {templates.map(tmpl => (
            <li key={tmpl.id} className="p-4 rounded-2xl flex items-center gap-3" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${tmpl.color}22` }}
              >
                {tmpl.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{tmpl.name}</div>
                {tmpl.description && <div className="text-xs font-body truncate mt-0.5" style={{ color: '#9a8878' }}>{tmpl.description}</div>}
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tmpl.color }} />
            </li>
          ))}
          {borrowedTemplates.map(tmpl => (
            <li key={tmpl.id} className="relative p-4 rounded-2xl flex items-center gap-3" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <VaultRibbon ownerName={tmpl.ownerName} />
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${tmpl.color}22` }}
              >
                {tmpl.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{tmpl.name}</div>
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tmpl.color }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
