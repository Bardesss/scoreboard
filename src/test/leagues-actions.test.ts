import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    league: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    leagueMember: { createMany: vi.fn() },
    playedGame: { create: vi.fn() },
    scoreEntry: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/credits', () => ({
  deductCredits: vi.fn().mockResolvedValue({ newMonthly: 65, newPermanent: 0 }),
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor() { super('Insufficient credits') }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deductCredits, checkRateLimit } from '@/lib/credits'
import { createLeague, deleteLeague } from '@/app/app/leagues/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown[]) => ops)
})

describe('createLeague', () => {
  it('deducts credits and creates league with members', async () => {
    vi.mocked(prisma.league.create).mockResolvedValue({ id: 'lg1' } as never)
    const result = await createLeague({
      name: 'Wednesday Catan',
      description: '',
      gameTemplateId: 'gt1',
      playerIds: ['p1', 'p2'],
    })
    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 'league')
    expect(deductCredits).toHaveBeenCalledWith('user-1', 'league', expect.any(Object))
    expect(result).toEqual({ success: true, id: 'lg1' })
  })

  it('returns error when name is empty', async () => {
    const result = await createLeague({ name: '', description: '', gameTemplateId: 'gt1', playerIds: [] })
    expect(result).toEqual({ success: false, error: 'errors.required' })
    expect(deductCredits).not.toHaveBeenCalled()
  })

  it('returns error when no game template selected', async () => {
    const result = await createLeague({ name: 'Test', description: '', gameTemplateId: '', playerIds: [] })
    expect(result).toEqual({ success: false, error: 'errors.required' })
  })

  it('returns insufficientCredits on InsufficientCreditsError', async () => {
    const { InsufficientCreditsError } = await import('@/lib/credits')
    vi.mocked(deductCredits).mockRejectedValueOnce(new InsufficientCreditsError())
    const result = await createLeague({ name: 'Test', description: '', gameTemplateId: 'gt1', playerIds: [] })
    expect(result).toEqual({ success: false, error: 'errors.insufficientCredits' })
  })
})

describe('deleteLeague', () => {
  it('deletes own league', async () => {
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'lg1', ownerId: 'user-1' } as never)
    vi.mocked(prisma.league.delete).mockResolvedValue({ id: 'lg1' } as never)
    const result = await deleteLeague('lg1')
    expect(result).toEqual({ success: true })
  })

  it("rejects delete of another user's league", async () => {
    vi.mocked(prisma.league.findUnique).mockResolvedValue({ id: 'lg1', ownerId: 'other' } as never)
    const result = await deleteLeague('lg1')
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})
