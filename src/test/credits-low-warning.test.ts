import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    adminSettings: { findUnique: vi.fn() },
    freePeriod: { findFirst: vi.fn() },
    creditTransaction: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/redis', () => ({ redis: { set: vi.fn().mockResolvedValue('OK') } }))
vi.mock('@/lib/mail', () => ({ sendLowCreditWarningEmail: vi.fn().mockResolvedValue(undefined) }))

import { prisma } from '@/lib/prisma'
import { sendLowCreditWarningEmail } from '@/lib/mail'
import { deductCreditsWithWarning } from '@/lib/credits'

const baseUser = {
  monthlyCredits: 25,
  permanentCredits: 0,
  isLifetimeFree: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.freePeriod.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown[]) => ops)
})

describe('deductCreditsWithWarning', () => {
  it('sends low-credit warning when balance drops below threshold after deduction', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ ...baseUser, monthlyCredits: 25 } as never)
    vi.mocked(prisma.adminSettings.findUnique).mockImplementation(async ({ where: { key } }: { where: { key: string } }) => {
      if (key === 'low_credit_threshold') return { key, value: 21 }
      return null
    })

    await deductCreditsWithWarning('user-1', 'played_game', undefined, { email: 'test@example.com', locale: 'en' })

    expect(sendLowCreditWarningEmail).toHaveBeenCalledWith('test@example.com', 20, 'en')
  })

  it('does not send warning when balance is above threshold after deduction', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ ...baseUser, monthlyCredits: 50 } as never)
    vi.mocked(prisma.adminSettings.findUnique).mockImplementation(async ({ where: { key } }: { where: { key: string } }) => {
      if (key === 'low_credit_threshold') return { key, value: 20 }
      return null
    })

    await deductCreditsWithWarning('user-1', 'played_game', undefined, { email: 'test@example.com', locale: 'en' })

    expect(sendLowCreditWarningEmail).not.toHaveBeenCalled()
  })
})
