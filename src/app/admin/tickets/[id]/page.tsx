import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import AdminTicketActions from './AdminTicketActions'

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, locale: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!ticket) notFound()

  const now = new Date()
  const autoCloseMs = ticket.autoCloseAt ? ticket.autoCloseAt.getTime() - now.getTime() : null
  const autoCloseDays = autoCloseMs !== null ? Math.ceil(autoCloseMs / (1000 * 60 * 60 * 24)) : null

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>{ticket.subject}</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          {ticket.user.email} · {ticket.category} ·{' '}
          <span style={{ color: ticket.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
            {ticket.status === 'open' ? 'Open' : 'Gesloten'}
          </span>
        </p>
        {autoCloseDays !== null && ticket.status === 'open' && (
          <p style={{ fontSize: 12, color: autoCloseDays <= 1 ? '#fbbf24' : 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            Auto-sluit over {autoCloseDays} dag{autoCloseDays !== 1 ? 'en' : ''}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {ticket.messages.map(msg => {
          const isUser = msg.senderType === 'user'
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-start' : 'flex-end' }}>
              <div style={{ maxWidth: '80%', background: isUser ? 'rgba(255,255,255,0.06)' : 'rgba(74,142,255,0.12)', border: `1px solid ${isUser ? 'rgba(255,255,255,0.08)' : 'rgba(74,142,255,0.25)'}`, borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: 600 }}>
                  {isUser ? ticket.user.email : 'Admin'}
                </p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.87)', whiteSpace: 'pre-wrap', margin: 0 }}>{msg.body}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, marginBottom: 0 }}>{msg.createdAt.toLocaleDateString('nl-NL')}</p>
              </div>
            </div>
          )
        })}
      </div>

      <AdminTicketActions ticketId={id} status={ticket.status} />
    </div>
  )
}
