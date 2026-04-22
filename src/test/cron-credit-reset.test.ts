import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    creditTransaction: { createMany: vi.fn(), create: vi.fn() },
    adminSettings: { findUnique: vi.fn() },
    freePeriod: { findFirst: vi.fn() },
    ticket: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn().mockResolvedValue('OK') },
}))
vi.mock('@/lib/mail', () => ({
  sendMonthlyResetEmail: vi.fn().mockResolvedValue(undefined),
  sendTicketAutoClosedEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/credits', () => ({ isFreeModeActive: vi.fn().mockResolvedValue(false) }))

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { sendMonthlyResetEmail, sendTicketAutoClosedEmail } from '@/lib/mail'
import { GET } from '@/app/api/cron/credit-reset/route'

const cronSecret = 'test-secret'

function makeRequest(secret = cronSecret) {
  return new Request('http://localhost/api/cron/credit-reset', {
    headers: { Authorization: `Bearer ${secret}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = cronSecret
  vi.mocked(redis.set).mockResolvedValue('OK')
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'monthly_free_credits', value: 75 } as never)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown[]) => ops)
  vi.mocked(prisma.ticket.findMany).mockResolvedValue([])
  vi.mocked(prisma.user.findMany).mockResolvedValue([])
})

describe('GET /api/cron/credit-reset', () => {
  it('returns 401 when Authorization header is missing or wrong', async () => {
    const res = await GET(new Request('http://localhost/api/cron/credit-reset'))
    expect(res.status).toBe(401)

    const res2 = await GET(makeRequest('wrong-secret'))
    expect(res2.status).toBe(401)
  })

  it('returns 409 when redis lock already set (already ran this month)', async () => {
    vi.mocked(redis.set).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(409)
  })

  it('resets monthly credits for non-lifetime-free users and skips lifetime free', async () => {
    const users = [
      { id: 'u1', email: 'a@test.com', locale: 'en', monthlyCredits: 30, isLifetimeFree: false },
      { id: 'u2', email: 'b@test.com', locale: 'nl', monthlyCredits: 75, isLifetimeFree: false },
      { id: 'u3', email: 'c@test.com', locale: 'en', monthlyCredits: 100, isLifetimeFree: true },
    ]
    vi.mocked(prisma.user.findMany).mockResolvedValue(users as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reset).toBe(2)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(sendMonthlyResetEmail).toHaveBeenCalledWith('a@test.com', 75, 'en')
    expect(sendMonthlyResetEmail).toHaveBeenCalledWith('b@test.com', 75, 'nl')
    expect(sendMonthlyResetEmail).not.toHaveBeenCalledWith('c@test.com', expect.anything(), expect.anything())
  })

  it('auto-closes stale tickets and sends email', async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValue([
      { id: 't1', subject: 'Bug report', user: { email: 'x@test.com', locale: 'en' } },
    ] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ticketsClosed).toBe(1)
    expect(sendTicketAutoClosedEmail).toHaveBeenCalledWith('x@test.com', 'Bug report', 'en')
  })
})
