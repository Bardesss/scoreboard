import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Plus, MessageSquare } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

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
    <div className="max-w-4xl mx-auto py-8 px-2">
      <PageHeader
        title={t('title')}
        trailing={
          <Link
            href="/app/support/new"
            aria-label={t('newTicket')}
            title={t('newTicket')}
            className="flex items-center justify-center gap-2 rounded-xl font-headline font-bold text-sm w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2"
            style={{ background: '#f5a623', color: '#1c1408', textDecoration: 'none' }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t('newTicket')}</span>
          </Link>
        }
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={26} strokeWidth={2.2} />}
          title={t('noTickets')}
          action={
            <Link
              href="/app/support/new"
              className="flex items-center gap-2 rounded-xl font-headline font-bold text-sm px-4 py-2"
              style={{ background: '#f5a623', color: '#1c1408', textDecoration: 'none' }}
            >
              <Plus size={15} strokeWidth={2.4} />
              {t('newTicket')}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {tickets.map(ticket => (
            <li key={ticket.id}>
              <Link
                href={`/app/support/${ticket.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: '#fefcf8', border: '1px solid #e8e1d8', textDecoration: 'none', display: 'flex' }}
              >
                <span
                  className="font-headline font-bold text-xs uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: '#fef3e2', color: '#c17d10' }}
                >
                  {categoryLabel(ticket.category)}
                </span>
                <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1e1a14' }}>
                  {ticket.subject}
                </span>
                <span
                  className="font-headline font-bold text-xs flex-shrink-0"
                  style={{ color: ticket.status === 'open' ? '#16a34a' : '#9a8878' }}
                >
                  {ticket.status === 'open' ? t('open') : t('closed')}
                </span>
                <span className="font-body text-xs flex-shrink-0" style={{ color: '#c5b89f' }}>
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
