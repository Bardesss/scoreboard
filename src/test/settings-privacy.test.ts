import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { updatePrivacySettings } from '@/app/app/settings/actions'

const session = { user: { id: 'user-1', email: 'me@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('updatePrivacySettings', () => {
  it('writes the validated values to the user row', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never)
    await updatePrivacySettings({ publicProfileMode: 'full', allowAppearInOthers: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { publicProfileMode: 'full', allowAppearInOthers: true },
    })
  })

  it('rejects an unknown mode', async () => {
    await expect(updatePrivacySettings({ publicProfileMode: 'bogus' as never, allowAppearInOthers: false }))
      .rejects.toThrow()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
