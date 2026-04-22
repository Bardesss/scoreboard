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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>{t('title')}</h1>
        <Link
          href="/app/support/new"
          style={{ background: '#f5a623', color: '#1c1408', fontWeight: 700, fontSize: 14, padding: '8px 18px', borderRadius: 10, textDecoration: 'none' }}
        >
          {t('newTicket')}
        </Link>
      </div>

      {tickets.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>{t('noTickets')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tickets.map(ticket => (
            <Link
              key={ticket.id}
              href={`/app/support/${ticket.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(245,166,35,0.15)', color: '#f5a623', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                {categoryLabel(ticket.category)}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.87)', fontWeight: 500 }}>
                {ticket.subject}
              </span>
              <span style={{ fontSize: 12, color: ticket.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                {ticket.status === 'open' ? t('open') : t('closed')}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                {ticket.updatedAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
