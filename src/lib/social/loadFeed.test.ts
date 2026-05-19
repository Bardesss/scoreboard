import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playedGame: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { loadPersonalFeed } from '@/lib/social/loadFeed'

beforeEach(() => {
  vi.mocked(prisma.playedGame.count).mockResolvedValue(0 as never)
  vi.mocked(prisma.playedGame.findMany).mockResolvedValue([] as never)
})

describe('loadPersonalFeed', () => {
  it('filters to status=approved and the OR of ownership / borrowed-player membership', async () => {
    await loadPersonalFeed('user-1', 1, 10)
    const call = vi.mocked(prisma.playedGame.findMany).mock.calls[0]?.[0]
    expect(call?.where).toEqual({
      status: 'approved',
      OR: [
        { league: { ownerId: 'user-1' } },
        { league: { members: { some: { player: { linkedUserId: 'user-1' } } } } },
      ],
    })
  })

  it('orders by playedAt desc and paginates', async () => {
    await loadPersonalFeed('user-1', 3, 10)
    const call = vi.mocked(prisma.playedGame.findMany).mock.calls[0]?.[0]
    expect(call?.orderBy).toEqual({ playedAt: 'desc' })
    expect(call?.skip).toBe(20)
    expect(call?.take).toBe(10)
  })

  it('includes scores, league.gameTemplate, and reactions with a denormalized count', async () => {
    vi.mocked(prisma.playedGame.findMany).mockResolvedValueOnce([
      {
        id: 'g1',
        playedAt: new Date('2026-05-10T19:00:00Z'),
        league: { id: 'l1', name: 'Sundays', gameTemplate: { id: 't1', name: 'Risk', color: '#abc', icon: '🎲' } },
        scores: [{ id: 's1', score: 30, isWinner: true, player: { id: 'p1', name: 'Alice', linkedUserId: 'user-1' } }],
        reactions: [
          { emoji: '🔥', userId: 'user-1' },
          { emoji: '🔥', userId: 'user-2' },
          { emoji: '👏', userId: 'user-2' },
        ],
      },
    ] as never)
    vi.mocked(prisma.playedGame.count).mockResolvedValueOnce(1 as never)
    const result = await loadPersonalFeed('user-1', 1, 10)
    expect(result.total).toBe(1)
    expect(result.games[0]?.reactions).toEqual([
      { emoji: '🔥', count: 2, mine: true },
      { emoji: '👏', count: 1, mine: false },
    ])
  })
})
