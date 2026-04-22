'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTicketRepliedEmail, sendTicketClosedEmail } from '@/lib/mail'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function adminReplyToTicket(
  ticketId: string,
  body: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!await requireAdmin()) return { success: false, error: 'Unauthorized' }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { email: true, locale: true } } },
  })
  if (!ticket || ticket.status === 'closed') return { success: false, error: 'Not found or closed' }

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await Promise.all([
    prisma.ticketMessage.create({ data: { ticketId, senderType: 'admin', body } }),
    prisma.ticket.update({ where: { id: ticketId }, data: { autoCloseAt: sevenDaysFromNow } }),
  ])

  await sendTicketRepliedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})

  revalidatePath(`/admin/tickets/${ticketId}`)
  return { success: true }
}

export async function adminCloseTicket(
  ticketId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!await requireAdmin()) return { success: false, error: 'Unauthorized' }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { email: true, locale: true } } },
  })
  if (!ticket) return { success: false, error: 'Not found' }

  await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'closed', autoCloseAt: null } })
  await sendTicketClosedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})

  revalidatePath('/admin/tickets')
  revalidatePath(`/admin/tickets/${ticketId}`)
  return { success: true }
}
