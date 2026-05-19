import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playedGame: { findUnique: vi.fn() },
    notification: { createMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { fireConnectionGameLogged } from '@/lib/social/fireConnectionGameLogged'

beforeEach(() => vi.clearAllMocks())

describe('fireConnectionGameLogged', () => {
  it('notifies league members who were not participants', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1',
      league: {
        id: 'l-1', name: 'Sundays', ownerId: 'owner',
        gameTemplate: { name: 'Risk' },
        members: [
          { player: { userId: 'owner', linkedUserId: null } },
          { player: { userId: 'someone', linkedUserId: 'friend-1' } },
          { player: { userId: 'someone', linkedUserId: 'friend-2' } },
        ],
      },
      scores: [
        { player: { userId: 'owner', linkedUserId: null } },
        { player: { userId: 'someone', linkedUserId: 'friend-1' } },
      ],
    } as never)
    vi.mocked(prisma.notification.createMany).mockResolvedValueOnce({ count: 1 } as never)

    await fireConnectionGameLogged('pg-1')

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'friend-2', type: 'connection_game_logged' }),
      ],
    })
  })

  it('no-ops when every member was a participant', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1',
      league: { id: 'l-1', name: 'X', ownerId: 'owner', gameTemplate: { name: 'Risk' }, members: [{ player: { userId: 'owner', linkedUserId: null } }] },
      scores: [{ player: { userId: 'owner', linkedUserId: null } }],
    } as never)
    await fireConnectionGameLogged('pg-1')
    expect(prisma.notification.createMany).not.toHaveBeenCalled()
  })
})
