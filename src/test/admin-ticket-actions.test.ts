import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticket: { findUnique: vi.fn(), update: vi.fn() },
    ticketMessage: { create: vi.fn() },
    ticketAttachment: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/mail', () => ({
  sendTicketRepliedEmail: vi.fn().mockResolvedValue(undefined),
  sendTicketClosedEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendTicketRepliedEmail, sendTicketClosedEmail } from '@/lib/mail'
import { adminReplyToTicket, adminCloseTicket } from '@/app/admin/tickets/actions'

const adminSession = { user: { id: 'admin-1', email: 'admin@test.com', locale: 'en', role: 'admin' } }
const openTicket = {
  id: 'ticket-1', subject: 'Help!', status: 'open',
  user: { id: 'user-1', email: 'user@test.com', locale: 'en' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(adminSession as never)
})

function replyFormData(body: string): FormData {
  const fd = new FormData()
  fd.set('body', body)
  return fd
}

describe('adminReplyToTicket', () => {
  it('creates admin message, sets autoCloseAt, sends email', async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(openTicket as never)
    vi.mocked(prisma.ticketMessage.create).mockResolvedValue({ id: 'msg-1' } as never)

    const result = await adminReplyToTicket('ticket-1', replyFormData('Here is the answer'))
    expect(result).toEqual({ success: true })
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', senderType: 'admin', body: 'Here is the answer' },
    })
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ticket-1' }, data: expect.objectContaining({ autoCloseAt: expect.any(Date) }) })
    )
    expect(sendTicketRepliedEmail).toHaveBeenCalledWith('user@test.com', 'Help!', 'en')
  })

  it('rejects non-admin user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', role: 'user' } } as never)
    const result = await adminReplyToTicket('ticket-1', replyFormData('body'))
    expect(result).toEqual({ success: false, error: 'Unauthorized' })
  })
})

describe('adminCloseTicket', () => {
  it('closes ticket and sends email', async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue(openTicket as never)
    const result = await adminCloseTicket('ticket-1')
    expect(result).toEqual({ success: true })
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-1' }, data: { status: 'closed', autoCloseAt: null },
    })
    expect(sendTicketClosedEmail).toHaveBeenCalledWith('user@test.com', 'Help!', 'en')
  })
})
