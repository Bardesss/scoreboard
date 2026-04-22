import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import TicketReplyForm from './TicketReplyForm'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const t = await getTranslations({ locale, namespace: 'support' })

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!ticket || ticket.userId !== session.user.id) notFound()

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>{ticket.subject}</h1>
        <span style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 600, color: ticket.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
          {ticket.status === 'open' ? t('open') : t('closed')}
        </span>
      </div>

      {ticket.status === 'open' && ticket.autoCloseAt && (
        <p style={{ fontSize: 13, color: '#fbbf24', marginBottom: 16 }}>
          {t('autoCloseNotice', { date: ticket.autoCloseAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB') })}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {ticket.messages.map(msg => {
          const isUser = msg.senderType === 'user'
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '80%', background: isUser ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isUser ? 'rgba(245,166,35,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 600 }}>
                  {isUser ? session.user.email : t('admin')}
                </p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.87)', whiteSpace: 'pre-wrap', margin: 0 }}>{msg.body}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, marginBottom: 0 }}>
                  {msg.createdAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB')}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {ticket.status === 'closed' ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{t('closedNotice')}</p>
      ) : (
        <TicketReplyForm ticketId={id} replyLabel={t('reply')} placeholder={t('replyPlaceholder')} />
      )}
    </div>
  )
}
