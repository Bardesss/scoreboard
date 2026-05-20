import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: vi.fn() },
    player: { updateMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { AVATAR_COLORS, AVATAR_ICONS } from '@/lib/avatarOptions'
import { updateAvatar, removeAvatar } from '@/app/app/settings/actions'

const session = { user: { id: 'user-1', email: 'me@example.com', locale: 'en', role: 'user' } }
const validColor = AVATAR_COLORS[0]
const validIcon = AVATAR_ICONS[0]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(prisma.user.update).mockResolvedValue({} as never)
  vi.mocked(prisma.player.updateMany).mockResolvedValue({ count: 1 } as never)
})

describe('updateAvatar', () => {
  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    expect(await updateAvatar(validColor, validIcon)).toEqual({ success: false, error: 'unauthorized' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects a colour not in the allowed list', async () => {
    expect(await updateAvatar('#123456', validIcon)).toEqual({ success: false, error: 'invalid' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects an icon not in the allowed list', async () => {
    expect(await updateAvatar(validColor, 'X')).toEqual({ success: false, error: 'invalid' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('writes the avatar to the user and syncs the me-player', async () => {
    const result = await updateAvatar(validColor, validIcon)
    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarColor: validColor, avatarIcon: validIcon },
    })
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { linkedUserId: 'user-1' },
      data: { color: validColor, icon: validIcon },
    })
  })
})

describe('removeAvatar', () => {
  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    expect(await removeAvatar()).toEqual({ success: false, error: 'unauthorized' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('clears the user avatar and the me-player icon', async () => {
    const result = await removeAvatar()
    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarColor: null, avatarIcon: null },
    })
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { linkedUserId: 'user-1' },
      data: { icon: null },
    })
  })
})
