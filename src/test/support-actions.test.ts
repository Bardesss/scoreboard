import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticket: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    ticketMessage: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createTicket, replyToTicket } from '@/app/app/support/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('createTicket', () => {
  it('creates ticket and initial message, returns ticket id', async () => {
    vi.mocked(prisma.ticket.create).mockResolvedValue({ id: 'ticket-1' } as never)

    const fd = new FormData()
    fd.set('category', 'bug')
    fd.set('subject', 'App crashes')
    fd.set('body', 'Steps to reproduce...')

    const result = await createTicket(fd)
    expect(result).toEqual({ success: true, ticketId: 'ticket-1' })
    expect(prisma.ticket.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', category: 'bug', subject: 'App crashes', status: 'open' },
    })
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', senderType: 'user', body: 'Steps to reproduce...' },
    })
  })

  it('returns error when category is invalid', async () => {
    const fd = new FormData()
    fd.set('category', 'invalid')
    fd.set('subject', 'test')
    fd.set('body', 'body')

    const result = await createTicket(fd)
    expect(result).toEqual({ success: false, error: 'Invalid category' })
  })

  it('requires auth', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const fd = new FormData()
    fd.set('category', 'bug')
    fd.set('subject', 'test')
    fd.set('body', 'body')

    const result = await createTicket(fd)
    expect(result).toEqual({ success: false, error: 'Unauthorized' })
  })
})

describe('replyToTicket', () => {
  it('creates a user message and resets autoCloseAt', async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
      id: 'ticket-1', userId: 'user-1', status: 'open',
    } as never)

    const result = await replyToTicket('ticket-1', 'My reply text')
    expect(result).toEqual({ success: true })
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', senderType: 'user', body: 'My reply text' },
    })
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ticket-1' }, data: expect.objectContaining({ autoCloseAt: expect.any(Date) }) })
    )
  })

  it('rejects reply on closed ticket', async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
      id: 'ticket-1', userId: 'user-1', status: 'closed',
    } as never)

    const result = await replyToTicket('ticket-1', 'reply')
    expect(result).toEqual({ success: false, error: 'Ticket is closed' })
  })

  it("rejects reply on another user's ticket", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
      id: 'ticket-1', userId: 'other-user', status: 'open',
    } as never)

    const result = await replyToTicket('ticket-1', 'reply')
    expect(result).toEqual({ success: false, error: 'Not found' })
  })
})
