import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/admin/costAnalytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/admin/costAnalytics')>()),
  loadCostAnalytics: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { loadCostAnalytics } from '@/lib/admin/costAnalytics'
import { applyScenario } from '@/app/admin/settings/recommendations/actions'

const admin = { user: { id: 'a1', email: 'a@x.com', locale: 'en', role: 'admin' } }

const analytics = {
  activeUsers: [
    { userId: 'u1', totalSpend: 20, actionCounts: {} },
    { userId: 'u2', totalSpend: 40, actionCounts: {} },
  ],
  perAction: [],
  windowStart: new Date(),
  windowEnd: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(admin as never)
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'monthly_free_credits', value: 75 } as never)
  vi.mocked(loadCostAnalytics).mockResolvedValue(analytics as never)
})

describe('applyScenario', () => {
  it('rejects a non-admin caller', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    expect(await applyScenario('balanced', 30)).toEqual({ ok: false, error: 'unauthorized' })
    expect(prisma.adminSettings.upsert).not.toHaveBeenCalled()
  })

  it('no-ops for status_quo (writes nothing, returns current value)', async () => {
    const result = await applyScenario('status_quo', 30)
    expect(result).toEqual({ ok: true, newValue: 75 })
    expect(prisma.adminSettings.upsert).not.toHaveBeenCalled()
  })

  it('writes the recommended monthly_free_credits for a real scenario', async () => {
    // balanced → p50 of [20,40] = 30 → ceilTo5 = 30
    const result = await applyScenario('balanced', 30)
    expect(result).toEqual({ ok: true, newValue: 30 })
    expect(prisma.adminSettings.upsert).toHaveBeenCalledWith({
      where: { key: 'monthly_free_credits' },
      update: { value: 30 },
      create: { key: 'monthly_free_credits', value: 30 },
    })
  })

  it('returns ok:false on an unexpected failure', async () => {
    vi.mocked(loadCostAnalytics).mockRejectedValue(new Error('db down'))
    expect(await applyScenario('balanced', 30)).toEqual({ ok: false, error: 'unknown' })
  })
})
