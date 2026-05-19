import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { adminSettings: { findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { loadFreeModeState } from '@/lib/freeMode'

beforeEach(() => vi.clearAllMocks())

describe('loadFreeModeState', () => {
  it('returns active=true with both banner texts when all three rows exist', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([
      { key: 'free_mode_active', value: true },
      { key: 'free_mode_banner_nl', value: 'Gratis te gebruiken' },
      { key: 'free_mode_banner_en', value: 'Currently free to use' },
    ] as never)
    const state = await loadFreeModeState()
    expect(state).toEqual({
      active: true,
      bannerNl: 'Gratis te gebruiken',
      bannerEn: 'Currently free to use',
    })
  })

  it('queries only the three relevant keys', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([] as never)
    await loadFreeModeState()
    expect(prisma.adminSettings.findMany).toHaveBeenCalledWith({
      where: { key: { in: ['free_mode_active', 'free_mode_banner_nl', 'free_mode_banner_en'] } },
    })
  })

  it('returns active=false and empty texts when no rows exist', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([] as never)
    expect(await loadFreeModeState()).toEqual({ active: false, bannerNl: '', bannerEn: '' })
  })

  it('returns active=false when the toggle row has a non-boolean value', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([
      { key: 'free_mode_active', value: 'yes' },
    ] as never)
    expect((await loadFreeModeState()).active).toBe(false)
  })

  it('treats non-string banner text values as empty (defensive)', async () => {
    vi.mocked(prisma.adminSettings.findMany).mockResolvedValueOnce([
      { key: 'free_mode_active', value: true },
      { key: 'free_mode_banner_nl', value: 42 },
      { key: 'free_mode_banner_en', value: null },
    ] as never)
    const state = await loadFreeModeState()
    expect(state.bannerNl).toBe('')
    expect(state.bannerEn).toBe('')
  })
})
