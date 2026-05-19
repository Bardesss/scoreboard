import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { playedGame: { findUnique: vi.fn(), count: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { findGamePageNumber } from '@/lib/social/findGamePage'

beforeEach(() => vi.clearAllMocks())

describe('findGamePageNumber', () => {
  it('returns 1 when the target game is among the most recent', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({ playedAt: new Date('2026-05-15') } as never)
    vi.mocked(prisma.playedGame.count).mockResolvedValueOnce(3 as never)
    const page = await findGamePageNumber({ targetGameId: 'g1', userId: 'u1', perPage: 10 })
    expect(page).toBe(1)
  })

  it('returns the right page when target sits deeper', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({ playedAt: new Date('2026-04-01') } as never)
    vi.mocked(prisma.playedGame.count).mockResolvedValueOnce(24 as never)
    const page = await findGamePageNumber({ targetGameId: 'g1', userId: 'u1', perPage: 10 })
    expect(page).toBe(3)
  })

  it('returns 1 if target not found (graceful)', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce(null as never)
    const page = await findGamePageNumber({ targetGameId: 'missing', userId: 'u1', perPage: 10 })
    expect(page).toBe(1)
  })
})
