import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    playedGame: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    scoreEntry: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/redis', () => ({ redis: { del: vi.fn() } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { editPlayedGame, deletePlayedGame } from '@/app/app/leagues/[id]/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown[]) => ops)
})

describe('editPlayedGame', () => {
  it('updates the played game and its scores in a transaction', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1',
      leagueId: 'lg1',
      submittedById: 'user-1',
      status: 'approved',
      league: { ownerId: 'user-1' },
    } as never)

    const result = await editPlayedGame('pg1', 'lg1', {
      playedAt: new Date('2026-04-21T20:00:00Z'),
      notes: 'edited',
      scores: [{ playerId: 'p1', score: 10 }, { playerId: 'p2', score: 5 }],
    })

    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.scoreEntry.deleteMany).toHaveBeenCalledWith({ where: { playedGameId: 'pg1' } })
    expect(prisma.scoreEntry.createMany).toHaveBeenCalledWith({
      data: [
        { playedGameId: 'pg1', playerId: 'p1', score: 10 },
        { playedGameId: 'pg1', playerId: 'p2', score: 5 },
      ],
    })
    expect(result).toEqual({ success: true })
  })

  it('rejects if the user does not own the league', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1',
      leagueId: 'lg1',
      league: { ownerId: 'other-user' },
    } as never)

    const result = await editPlayedGame('pg1', 'lg1', {
      playedAt: new Date(),
      notes: '',
      scores: [],
    })

    expect(result).toEqual({ success: false, error: 'notFound' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects if the session does not exist', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue(null)

    const result = await editPlayedGame('missing', 'lg1', {
      playedAt: new Date(),
      notes: '',
      scores: [],
    })

    expect(result).toEqual({ success: false, error: 'notFound' })
  })
})

describe('deletePlayedGame', () => {
  it('hard-deletes the played game', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1',
      leagueId: 'lg1',
      submittedById: 'user-1',
      league: { ownerId: 'user-1' },
    } as never)
    vi.mocked(prisma.playedGame.delete).mockResolvedValue({ id: 'pg1' } as never)

    const result = await deletePlayedGame('pg1', 'lg1')

    expect(prisma.playedGame.delete).toHaveBeenCalledWith({ where: { id: 'pg1' } })
    expect(result).toEqual({ success: true })
  })

  it('rejects if the user does not own the league', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1',
      leagueId: 'lg1',
      league: { ownerId: 'other-user' },
    } as never)

    const result = await deletePlayedGame('pg1', 'lg1')

    expect(result).toEqual({ success: false, error: 'notFound' })
    expect(prisma.playedGame.delete).not.toHaveBeenCalled()
  })

  it('rejects if the session does not exist', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue(null)

    const result = await deletePlayedGame('missing', 'lg1')

    expect(result).toEqual({ success: false, error: 'notFound' })
  })
})
