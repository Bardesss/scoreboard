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
import { updateDisplayName } from '@/app/app/settings/actions'

const session = { user: { id: 'user-1', email: 'me@example.com', locale: 'en', role: 'user' } }

function form(displayName: string): FormData {
  const fd = new FormData()
  fd.set('displayName', displayName)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(prisma.user.update).mockResolvedValue({} as never)
  vi.mocked(prisma.player.updateMany).mockResolvedValue({ count: 1 } as never)
})

describe('updateDisplayName', () => {
  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    expect(await updateDisplayName(form('Bartus'))).toEqual({ success: false, error: 'unauthorized' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects an empty (whitespace-only) display name', async () => {
    expect(await updateDisplayName(form('   '))).toEqual({ success: false, error: 'display_name_invalid' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects a display name longer than 40 characters', async () => {
    expect(await updateDisplayName(form('x'.repeat(41)))).toEqual({ success: false, error: 'display_name_invalid' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('writes the trimmed name to the user and the linked me-player', async () => {
    const result = await updateDisplayName(form('  Bartus V.  '))
    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { displayName: 'Bartus V.' },
    })
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { linkedUserId: 'user-1' },
      data: { name: 'Bartus V.' },
    })
  })
})
