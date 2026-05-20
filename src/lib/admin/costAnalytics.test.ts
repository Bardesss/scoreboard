import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creditTransaction: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { percentile, loadCostAnalytics, getDaysOfActivity } from './costAnalytics'

const DAY_MS = 24 * 60 * 60 * 1000

describe('percentile', () => {
  it('returns 0 for an empty array', () => {
    expect(percentile([], 50)).toBe(0)
  })
  it('returns the only value for a single-element array', () => {
    expect(percentile([7], 90)).toBe(7)
  })
  it('computes the median with linear interpolation', () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25)
  })
  it('computes p75 and p25 with linear interpolation', () => {
    expect(percentile([10, 20, 30, 40], 75)).toBe(32.5)
    expect(percentile([10, 20, 30, 40], 25)).toBe(17.5)
  })
  it('sorts the input before computing', () => {
    expect(percentile([40, 10, 30, 20], 50)).toBe(25)
  })
})

describe('loadCostAnalytics', () => {
  beforeEach(() => vi.clearAllMocks())

  const rows = [
    { userId: 'u1', delta: -5, reason: 'played_game' },
    { userId: 'u1', delta: -10, reason: 'league' },
    { userId: 'u2', delta: -25, reason: 'game_template' },
    { userId: 'u2', delta: -5, reason: 'played_game' },
  ]

  it('aggregates total spend and per-action counts per user', async () => {
    vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue(rows as never)
    const result = await loadCostAnalytics(30)

    const u1 = result.activeUsers.find(u => u.userId === 'u1')
    const u2 = result.activeUsers.find(u => u.userId === 'u2')
    expect(u1).toEqual({ userId: 'u1', totalSpend: 15, actionCounts: { played_game: 1, league: 1 } })
    expect(u2).toEqual({ userId: 'u2', totalSpend: 30, actionCounts: { game_template: 1, played_game: 1 } })
  })

  it('computes per-action percentiles over row-level spend', async () => {
    vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue(rows as never)
    const result = await loadCostAnalytics(30)

    const playedGame = result.perAction.find(a => a.reason === 'played_game')
    expect(playedGame).toEqual({ reason: 'played_game', p25: 5, p50: 5, p75: 5, p90: 5, mean: 5 })
  })

  it('queries only spend rows from non-lifetime-free users within the window', async () => {
    vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue([] as never)
    await loadCostAnalytics(30)
    expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          delta: { lt: 0 },
          user: { isLifetimeFree: false },
        }),
      })
    )
  })

  it('returns a window spanning windowDays', async () => {
    vi.mocked(prisma.creditTransaction.findMany).mockResolvedValue([] as never)
    const result = await loadCostAnalytics(60)
    const span = result.windowEnd.getTime() - result.windowStart.getTime()
    expect(Math.round(span / DAY_MS)).toBe(60)
  })
})

describe('getDaysOfActivity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 0 when there are no transactions', async () => {
    vi.mocked(prisma.creditTransaction.findFirst).mockResolvedValue(null)
    expect(await getDaysOfActivity()).toBe(0)
  })

  it('returns whole days since the earliest transaction', async () => {
    vi.mocked(prisma.creditTransaction.findFirst).mockResolvedValue(
      { createdAt: new Date(Date.now() - 25 * DAY_MS) } as never
    )
    expect(await getDaysOfActivity()).toBe(25)
  })
})
