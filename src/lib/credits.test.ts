import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deductCredits, getActionCost, isFreeModeActive, checkRateLimit, InsufficientCreditsError } from './credits'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminSettings: { findUnique: vi.fn() },
    freePeriod: { findFirst: vi.fn() },
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    creditTransaction: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn() },
}))

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const mockUser = (overrides: Partial<{
  monthlyCredits: number
  permanentCredits: number
  isLifetimeFree: boolean
}> = {}) => ({
  monthlyCredits: 75,
  permanentCredits: 0,
  isLifetimeFree: false,
  ...overrides,
})

beforeEach(() => {
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.freePeriod.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.$transaction).mockResolvedValue([])
})

describe('getActionCost', () => {
  it('returns DB value when set', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'cost_game_template', value: 30 })
    expect(await getActionCost('game_template')).toBe(30)
  })

  it('falls back to hardcoded defaults', async () => {
    expect(await getActionCost('game_template')).toBe(25)
    expect(await getActionCost('league')).toBe(10)
    expect(await getActionCost('played_game')).toBe(5)
  })
})

describe('isFreeModeActive', () => {
  it('returns true when toggle is on', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'free_mode_active', value: true })
    expect(await isFreeModeActive()).toBe(true)
  })

  it('returns true when inside a FreePeriod', async () => {
    vi.mocked(prisma.freePeriod.findFirst).mockResolvedValue({ id: 'fp1' } as never)
    expect(await isFreeModeActive()).toBe(true)
  })

  it('returns false when toggle off and no active period', async () => {
    expect(await isFreeModeActive()).toBe(false)
  })
})

describe('checkRateLimit', () => {
  it('passes when no rate limit entry exists', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK')
    await expect(checkRateLimit('user-1', 'game_template')).resolves.not.toThrow()
  })

  it('throws when rate limit is hit', async () => {
    vi.mocked(redis.set).mockResolvedValue(null)
    await expect(checkRateLimit('user-1', 'game_template')).rejects.toThrow('Rate limit')
  })
})

describe('deductCredits', () => {
  it('Case A: deducts entirely from monthly when monthly >= cost', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 75 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    expect(result).toEqual({ newMonthly: 50, newPermanent: 0 })
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('Case B: splits across monthly and permanent when monthly < cost', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 10, permanentCredits: 20 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    expect(result).toEqual({ newMonthly: 0, newPermanent: 5 })
  })

  it('Case C: deducts from permanent when monthly <= 0', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 0, permanentCredits: 30 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    expect(result).toEqual({ newMonthly: 0, newPermanent: 5 })
  })

  it('throws InsufficientCreditsError when total < cost and not free mode', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 5, permanentCredits: 0 }) as never)
    await expect(deductCredits('user-1', 'game_template')).rejects.toBeInstanceOf(InsufficientCreditsError)
  })

  it('skips deduction for lifetime-free users', async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ isLifetimeFree: true, monthlyCredits: 0, permanentCredits: 0 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    expect(result).toEqual({ newMonthly: 0, newPermanent: 0 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('Case C free mode: allows further negative monthly when monthly <= 0 and permanent < cost', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'free_mode_active', value: true })
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(
      mockUser({ monthlyCredits: 0, permanentCredits: 5 }) as never
    )
    // cost = 25 (game_template default), permanent = 5 < 25
    const result = await deductCredits('user-1', 'game_template')
    // permanent drains to 0, monthly goes to -(25 - 5) = -20
    expect(result.newPermanent).toBe(0)
    expect(result.newMonthly).toBe(-20)
  })

  it('Case B free mode: allows negative monthly when total < cost', async () => {
    // getActionCost calls findUnique with key 'cost_game_template' → null (use default 25)
    // isFreeModeActive calls findUnique with key 'free_mode_active' → true
    vi.mocked(prisma.adminSettings.findUnique).mockImplementation(async ({ where }) => {
      if ((where as { key: string }).key === 'free_mode_active') return { key: 'free_mode_active', value: true }
      return null
    })
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(mockUser({ monthlyCredits: 3, permanentCredits: 1 }) as never)
    const result = await deductCredits('user-1', 'game_template')
    // cost=25, monthly=3, permanent=1 → monthly goes to -21, permanent to 0
    expect(result.newPermanent).toBe(0)
    expect(result.newMonthly).toBe(-21)
  })
})
