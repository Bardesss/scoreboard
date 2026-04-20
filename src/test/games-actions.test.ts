import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    gameTemplate: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/credits', () => ({
  deductCredits: vi.fn().mockResolvedValue({ newMonthly: 50, newPermanent: 0 }),
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
import { createGameTemplate, deleteGameTemplate } from '@/app/app/games/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

const fullInput = {
  name: 'Catan',
  color: '#f5a623',
  icon: '🎲',
  winType: 'points-all',
  winCondition: 'high' as string | null,
  scoreFields: [] as string[],
  roles: [] as string[],
  missions: [] as string[],
  trackDifficulty: false,
  trackTeamScores: false,
  timeUnit: null as string | null,
  description: '',
  minPlayers: null as number | null,
  maxPlayers: null as number | null,
  scoringNotes: '',
  buyInEnabled: false,
  buyInCurrency: null as string | null,
}

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('createGameTemplate', () => {
  it('checks rate limit and deducts credits', async () => {
    vi.mocked(prisma.gameTemplate.create).mockResolvedValue({ id: 'gt1' } as never)
    const result = await createGameTemplate(fullInput)
    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 'game_template')
    expect(deductCredits).toHaveBeenCalledWith('user-1', 'game_template', expect.any(Object))
    expect(result).toEqual({ success: true, id: 'gt1' })
  })

  it('returns error when name is empty', async () => {
    const result = await createGameTemplate({ ...fullInput, name: '' })
    expect(result).toEqual({ success: false, error: 'errors.required' })
    expect(deductCredits).not.toHaveBeenCalled()
  })

  it('returns insufficientCredits error on InsufficientCreditsError', async () => {
    const { InsufficientCreditsError } = await import('@/lib/credits')
    vi.mocked(deductCredits).mockRejectedValueOnce(new InsufficientCreditsError())
    const result = await createGameTemplate(fullInput)
    expect(result).toEqual({ success: false, error: 'errors.insufficientCredits' })
  })

  it('persists all new fields to the database', async () => {
    vi.mocked(prisma.gameTemplate.create).mockResolvedValue({ id: 'gt2' } as never)
    await createGameTemplate({
      ...fullInput,
      name: 'Werewolf',
      winType: 'winner',
      winCondition: null,
      roles: ['Werewolf', 'Villager'],
      buyInEnabled: true,
      buyInCurrency: '€',
    })
    expect(prisma.gameTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        winType: 'winner',
        roles: ['Werewolf', 'Villager'],
        buyInEnabled: true,
        buyInCurrency: '€',
      }),
    })
  })
})

describe('deleteGameTemplate', () => {
  it('deletes own template', async () => {
    vi.mocked(prisma.gameTemplate.findUnique).mockResolvedValue({ id: 'gt1', userId: 'user-1' } as never)
    vi.mocked(prisma.gameTemplate.delete).mockResolvedValue({ id: 'gt1' } as never)
    const result = await deleteGameTemplate('gt1')
    expect(result).toEqual({ success: true })
  })

  it("rejects delete of another user's template", async () => {
    vi.mocked(prisma.gameTemplate.findUnique).mockResolvedValue({ id: 'gt1', userId: 'other' } as never)
    const result = await deleteGameTemplate('gt1')
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})
