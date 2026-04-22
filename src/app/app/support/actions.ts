'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const VALID_CATEGORIES = ['bug', 'feedback', 'question'] as const

export async function createTicket(
  formData: FormData
): Promise<{ success: true; ticketId: string } | { success: false; error: string }> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const category = formData.get('category') as string
  const subject = (formData.get('subject') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()

  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return { success: false, error: 'Invalid category' }
  }
  if (!subject || !body) return { success: false, error: 'Missing fields' }

  const ticket = await prisma.ticket.create({
    data: { userId: session.user.id, category, subject, status: 'open' },
  })
  await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, senderType: 'user', body },
  })

  revalidatePath('/app/support')
  return { success: true, ticketId: ticket.id }
}

export async function replyToTicket(
  ticketId: string,
  body: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket || ticket.userId !== session.user.id) return { success: false, error: 'Not found' }
  if (ticket.status === 'closed') return { success: false, error: 'Ticket is closed' }

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await Promise.all([
    prisma.ticketMessage.create({ data: { ticketId, senderType: 'user', body } }),
    prisma.ticket.update({ where: { id: ticketId }, data: { autoCloseAt: sevenDaysFromNow } }),
  ])

  revalidatePath(`/app/support/${ticketId}`)
  return { success: true }
}
