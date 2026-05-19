import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    playedGame: { findUnique: vi.fn() },
    playedGameReaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    leagueMember: { count: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/redis', () => ({
  redis: { incr: vi.fn(), expire: vi.fn() },
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { toggleReaction } from '@/app/app/social/actions'

const session = { user: { id: 'user-1', email: 'me@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(redis.incr).mockResolvedValue(1 as never)
  vi.mocked(redis.expire).mockResolvedValue(1 as never)
})

describe('toggleReaction', () => {
  it('rejects unknown emoji', async () => {
    const r = await toggleReaction('pg-1', '🍕')
    expect(r).toEqual({ error: 'invalidEmoji' })
  })

  it('rejects when rate-limited (incr > 1)', async () => {
    vi.mocked(redis.incr).mockResolvedValueOnce(2 as never)
    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ error: 'rateLimited' })
  })

  it('returns notFound for non-approved games', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1', status: 'pending', league: { id: 'l-1', ownerId: 'someone' },
    } as never)
    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ error: 'notFound' })
  })

  it('returns notAllowed when caller is not a member and not the owner', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1', status: 'approved', league: { id: 'l-1', ownerId: 'someone-else' },
    } as never)
    vi.mocked(prisma.leagueMember.count).mockResolvedValueOnce(0 as never)
    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ error: 'notAllowed' })
  })

  it('creates a new reaction when none exists, returns aggregated list', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1', status: 'approved', league: { id: 'l-1', ownerId: 'user-1' },
    } as never)
    vi.mocked(prisma.playedGameReaction.findUnique).mockResolvedValueOnce(null as never)
    vi.mocked(prisma.playedGameReaction.create).mockResolvedValueOnce({ id: 'r-1' } as never)
    vi.mocked(prisma.playedGameReaction.findMany).mockResolvedValueOnce([
      { emoji: '🔥', userId: 'user-1' },
    ] as never)

    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ reactions: [{ emoji: '🔥', count: 1, mine: true }] })
    expect(prisma.playedGameReaction.create).toHaveBeenCalledWith({
      data: { playedGameId: 'pg-1', userId: 'user-1', emoji: '🔥' },
    })
  })

  it('deletes when reaction exists (toggle off)', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValueOnce({
      id: 'pg-1', status: 'approved', league: { id: 'l-1', ownerId: 'user-1' },
    } as never)
    vi.mocked(prisma.playedGameReaction.findUnique).mockResolvedValueOnce({ id: 'r-1' } as never)
    vi.mocked(prisma.playedGameReaction.delete).mockResolvedValueOnce({ id: 'r-1' } as never)
    vi.mocked(prisma.playedGameReaction.findMany).mockResolvedValueOnce([] as never)

    const r = await toggleReaction('pg-1', '🔥')
    expect(r).toEqual({ reactions: [] })
    expect(prisma.playedGameReaction.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } })
  })
})
