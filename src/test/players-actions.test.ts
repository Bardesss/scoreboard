import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    player: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createPlayer, updatePlayer, deletePlayer } from '@/app/app/players/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('createPlayer', () => {
  it('creates a player with correct avatarSeed', async () => {
    vi.mocked(prisma.player.create).mockResolvedValue({ id: 'p1' } as never)
    const fd = new FormData()
    fd.set('name', 'Alice')
    const result = await createPlayer(fd)
    expect(result).toEqual({ success: true })
    expect(prisma.player.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', name: 'Alice', avatarSeed: 'alice' }),
    })
  })

  it('returns error when name is empty', async () => {
    const fd = new FormData()
    fd.set('name', '   ')
    const result = await createPlayer(fd)
    expect(result).toEqual({ success: false, error: 'errors.required' })
    expect(prisma.player.create).not.toHaveBeenCalled()
  })
})

describe('updatePlayer', () => {
  it('updates only own players', async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'p1', userId: 'user-1' } as never)
    vi.mocked(prisma.player.update).mockResolvedValue({ id: 'p1' } as never)
    const fd = new FormData()
    fd.set('name', 'Bob')
    const result = await updatePlayer('p1', fd)
    expect(result).toEqual({ success: true })
  })

  it("rejects update of another user's player", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'p1', userId: 'other-user' } as never)
    const fd = new FormData()
    fd.set('name', 'Bob')
    const result = await updatePlayer('p1', fd)
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})

describe('deletePlayer', () => {
  it('deletes own player', async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'p1', userId: 'user-1' } as never)
    vi.mocked(prisma.player.delete).mockResolvedValue({ id: 'p1' } as never)
    const result = await deletePlayer('p1')
    expect(result).toEqual({ success: true })
  })

  it("rejects delete of another user's player", async () => {
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'p1', userId: 'other-user' } as never)
    const result = await deletePlayer('p1')
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})
