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
import { loadPersonalFeed, loadPublicFeed } from '@/lib/social/loadFeed'

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

describe('loadPublicFeed', () => {
  it('filters to games where the profile owner has a ScoreEntry via a self-Player or linked Player', async () => {
    await loadPublicFeed('owner-1', 1, 10)
    const call = vi.mocked(prisma.playedGame.findMany).mock.calls.at(-1)?.[0]
    expect(call?.where).toEqual({
      status: 'approved',
      scores: {
        some: {
          player: {
            OR: [
              { linkedUserId: 'owner-1' },
              { userId: 'owner-1', linkedUserId: null },
            ],
          },
        },
      },
    })
  })

  it('anonymizes opponent names whose allowAppearInOthers is false', async () => {
    vi.mocked(prisma.playedGame.findMany).mockResolvedValueOnce([
      {
        id: 'g1',
        playedAt: new Date('2026-05-10T19:00:00Z'),
        league: { id: 'l1', name: 'Sundays', gameTemplate: { id: 't1', name: 'Risk', color: '#abc', icon: '🎲' } },
        scores: [
          { id: 's1', score: 30, isWinner: true, player: { id: 'p1', name: 'OwnerName', linkedUserId: 'owner-1', linkedUser: { allowAppearInOthers: true } } },
          { id: 's2', score: 20, isWinner: false, player: { id: 'p2', name: 'AnnaPrivate', linkedUserId: 'opp-1', linkedUser: { allowAppearInOthers: false } } },
          { id: 's3', score: 10, isWinner: false, player: { id: 'p3', name: 'BorisPublic', linkedUserId: 'opp-2', linkedUser: { allowAppearInOthers: true } } },
          { id: 's4', score: 5,  isWinner: false, player: { id: 'p4', name: 'UnlinkedFriend', linkedUserId: null, linkedUser: null } },
        ],
        reactions: [],
      },
    ] as never)
    vi.mocked(prisma.playedGame.count).mockResolvedValueOnce(1 as never)

    const result = await loadPublicFeed('owner-1', 1, 10)
    const names = result.games[0]?.scores.map(s => s.playerName)
    // owner's own row keeps real name; opted-out linked opponent becomes "Speler A";
    // opted-in opponent keeps name; unlinked player (no User to consult) keeps Player.name.
    expect(names).toEqual(['OwnerName', 'Speler A', 'BorisPublic', 'UnlinkedFriend'])
  })
})
