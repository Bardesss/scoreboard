import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { sendTicketAutoClosedEmail } from '@/lib/mail'
import { purgeTicketAttachments } from '@/lib/ticketAttachments'

function bearerOk(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header ?? '')
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Auto-closes support tickets that have gone quiet. Runs on its own daily
// schedule, decoupled from the monthly credit-reset cron: tickets go stale on a
// rolling 7-day basis (autoCloseAt is set on every reply), so closing them only
// once a month — as the old credit-reset coupling did — left them open for weeks.
export async function GET(req: Request) {
  if (!bearerOk(req.headers.get('Authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Short lock so two overlapping runs can't double-close / double-email the
  // same tickets. Unlike the credit-reset lock this is per-run, not per-month.
  const acquired = await redis.set('cron:ticket_autoclose', '1', 'EX', 300, 'NX')
  if (!acquired) {
    return NextResponse.json({ skipped: true, reason: 'already running' }, { status: 409 })
  }

  const now = new Date()
  const staleTickets = await prisma.ticket.findMany({
    where: { status: 'open', autoCloseAt: { lt: now } },
    select: { id: true, subject: true, user: { select: { email: true, locale: true } } },
  })

  if (staleTickets.length > 0) {
    for (const ticket of staleTickets) {
      await purgeTicketAttachments(ticket.id)
    }
    await prisma.ticket.updateMany({
      where: { id: { in: staleTickets.map(t => t.id) } },
      data: { status: 'closed', autoCloseAt: null },
    })
    for (const ticket of staleTickets) {
      await sendTicketAutoClosedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, ticketsClosed: staleTickets.length })
}
