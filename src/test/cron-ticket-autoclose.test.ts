import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ticket: { findMany: vi.fn(), updateMany: vi.fn() },
    ticketAttachment: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
  },
}))
vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/lib/mail', () => ({
  sendTicketAutoClosedEmail: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { sendTicketAutoClosedEmail } from '@/lib/mail'
import { GET } from '@/app/api/cron/ticket-autoclose/route'

const cronSecret = 'test-secret-1234567'

function makeRequest(secret = cronSecret) {
  return new Request('http://localhost/api/cron/ticket-autoclose', {
    headers: { Authorization: `Bearer ${secret}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = cronSecret
  vi.mocked(redis.set).mockResolvedValue('OK')
  vi.mocked(prisma.ticket.findMany).mockResolvedValue([])
  vi.mocked(prisma.ticketAttachment.findMany).mockResolvedValue([])
})

describe('GET /api/cron/ticket-autoclose', () => {
  it('returns 401 when Authorization header is missing or wrong', async () => {
    const res = await GET(new Request('http://localhost/api/cron/ticket-autoclose'))
    expect(res.status).toBe(401)

    const res2 = await GET(makeRequest('wrong-secret'))
    expect(res2.status).toBe(401)
  })

  it('returns 409 when another run holds the lock', async () => {
    vi.mocked(redis.set).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(409)
    expect(prisma.ticket.findMany).not.toHaveBeenCalled()
  })

  it('closes only open tickets whose autoCloseAt has passed', async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([
      { id: 't1', subject: 'Bug report', user: { email: 'x@test.com', locale: 'en' } },
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ticketsClosed).toBe(1)
    const where = (vi.mocked(prisma.ticket.findMany).mock.calls[0][0] as {
      where: { status: string; autoCloseAt: { lt: Date } }
    }).where
    expect(where.status).toBe('open')
    expect(where.autoCloseAt.lt).toBeInstanceOf(Date)
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1'] } },
      data: { status: 'closed', autoCloseAt: null },
    })
    expect(sendTicketAutoClosedEmail).toHaveBeenCalledWith('x@test.com', 'Bug report', 'en')
  })

  it('does nothing when no tickets are stale', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ticketsClosed).toBe(0)
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled()
    expect(sendTicketAutoClosedEmail).not.toHaveBeenCalled()
  })
})
