import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Dices, Plus } from 'lucide-react'

export default async function GamesPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const [templates, t] = await Promise.all([
    prisma.gameTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    }),
    getTranslations({ locale, namespace: 'app.games' }),
  ])

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

      {templates.length === 0 ? (
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {templates.map(tmpl => (
            <li key={tmpl.id} className="p-4 rounded-2xl flex items-center gap-3" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                <Dices size={18} style={{ color: '#f5a623' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{tmpl.name}</div>
                {tmpl.description && <div className="text-xs font-body truncate mt-0.5" style={{ color: '#9a8878' }}>{tmpl.description}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
