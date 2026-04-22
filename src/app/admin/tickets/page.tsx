import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>
}) {
  const { status = 'all', category = 'all' } = await searchParams

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.status = status
  if (category !== 'all') where.category = category

  const [tickets, unreadCount] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.ticket.count({
      where: { status: 'open', messages: { every: { senderType: 'user' } } },
    }),
  ])

  const categoryLabel = (cat: string) =>
    cat === 'bug' ? 'Bug' : cat === 'feedback' ? 'Feedback' : 'Vraag'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>Tickets</h1>
        {unreadCount > 0 && (
          <span style={{ background: '#f5a623', color: '#1c1408', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
            {unreadCount} ongelezen
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'open', 'closed'] as const).map(s => (
          <Link key={s} href={`/admin/tickets?status=${s}&category=${category}`} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: status === s ? 'rgba(245,166,35,0.2)' : 'rgba(255,255,255,0.05)', color: status === s ? '#f5a623' : 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
            {s === 'all' ? 'Alle' : s === 'open' ? 'Open' : 'Gesloten'}
          </Link>
        ))}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
        {(['all', 'bug', 'feedback', 'question'] as const).map(c => (
          <Link key={c} href={`/admin/tickets?status=${status}&category=${c}`} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: category === c ? 'rgba(74,142,255,0.2)' : 'rgba(255,255,255,0.05)', color: category === c ? '#4a8eff' : 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
            {c === 'all' ? 'Alle categorieën' : categoryLabel(c)}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tickets.length === 0 && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Geen tickets gevonden.</p>}
        {tickets.map(ticket => {
          const needsReply = ticket.messages[0]?.senderType === 'user'
          return (
            <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: needsReply ? 'rgba(245,166,35,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${needsReply ? 'rgba(245,166,35,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, textDecoration: 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                {categoryLabel(ticket.category)}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>{ticket.user.email}</span>
              <span style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.87)', fontWeight: needsReply ? 600 : 400 }}>{ticket.subject}</span>
              <span style={{ fontSize: 12, color: ticket.status === 'open' ? '#4ade80' : 'rgba(255,255,255,0.3)', fontWeight: 600, flexShrink: 0 }}>
                {ticket.status === 'open' ? 'Open' : 'Gesloten'}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{ticket.updatedAt.toLocaleDateString('nl-NL')}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
