import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function SupportPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const t = await getTranslations({ locale, namespace: 'app.support' })

  const tickets = await prisma.ticket.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, category: true, subject: true, status: true, updatedAt: true },
  })

  const categoryLabel = (cat: string) => {
    if (cat === 'bug') return t('categoryBug')
    if (cat === 'feedback') return t('categoryFeedback')
    return t('categoryQuestion')
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>
        <Link
          href="/app/support/new"
          className="font-headline font-bold text-sm px-4 py-2 rounded-xl"
          style={{ background: '#f5a623', color: '#1c1408', textDecoration: 'none' }}
        >
          {t('newTicket')}
        </Link>
      </div>

      {tickets.length === 0 ? (
        <p className="font-body text-sm py-12 text-center" style={{ color: '#9a8878' }}>{t('noTickets')}</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map(ticket => (
            <li key={ticket.id}>
              <Link
                href={`/app/support/${ticket.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: '#fffdf9', border: '1px solid #e8e1d8', textDecoration: 'none', display: 'flex' }}
              >
                <span
                  className="font-headline font-bold text-xs uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: '#fef3e2', color: '#c17d10' }}
                >
                  {categoryLabel(ticket.category)}
                </span>
                <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>
                  {ticket.subject}
                </span>
                <span
                  className="font-headline font-bold text-xs flex-shrink-0"
                  style={{ color: ticket.status === 'open' ? '#16a34a' : '#9a8878' }}
                >
                  {ticket.status === 'open' ? t('open') : t('closed')}
                </span>
                <span className="font-body text-xs flex-shrink-0" style={{ color: '#c4b79a' }}>
                  {ticket.updatedAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
