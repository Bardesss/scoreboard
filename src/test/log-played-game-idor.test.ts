import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    leagueMember: { findMany: vi.fn() },
    playedGame: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'owner' } }) }))
vi.mock('@/lib/credits', () => ({
  checkRateLimit: vi.fn(), deductCredits: vi.fn(),
  InsufficientCreditsError: class extends Error {},
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/stats/invalidateStatsCache', () => ({ invalidateStatsCache: vi.fn() }))
vi.mock('@/lib/social/fireConnectionGameLogged', () => ({ fireConnectionGameLogged: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/mail', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/emailPreferences', () => ({ shouldSendEmailTo: vi.fn() }))
vi.mock('@/lib/emailTemplates', () => ({
  playedGameApprovedEmail: vi.fn(), playedGameRejectedEmail: vi.fn(),
}))

import { prisma } from '@/lib/prisma'

beforeEach(() => { vi.clearAllMocks() })

it('rejects a participant that is not a league member', async () => {
  vi.mocked(prisma.league.findUnique).mockResolvedValue({
    id: 'L1', ownerId: 'owner',
    gameTemplate: { winType: 'winner', winCondition: null, scoreFields: [], roles: [], missions: [], trackDifficulty: false, trackTeamScores: false, trackEliminationOrder: false, timeUnit: null },
  } as never)
  vi.mocked(prisma.leagueMember.findMany).mockResolvedValue([{ playerId: 'p-legit' }] as never)

  const { logPlayedGame } = await import('@/app/app/leagues/[id]/actions')
  const result = await logPlayedGame('L1', {
    playedAt: new Date(), notes: '',
    resolverInput: { participantIds: ['p-legit', 'p-victim'], winnerId: 'p-legit' },
  } as never)

  expect(result).toEqual({ success: false, error: 'notFound' })
  expect(prisma.$transaction).not.toHaveBeenCalled()
})
