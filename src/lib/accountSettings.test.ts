import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { adminSettings: { findUnique: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { getUnverifiedGraceDays, DEFAULT_UNVERIFIED_GRACE_DAYS } from './accountSettings'

beforeEach(() => { vi.clearAllMocks() })

describe('getUnverifiedGraceDays', () => {
  it('returns the configured value when set to a positive number', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'unverified_purge_days', value: 3 } as never)
    expect(await getUnverifiedGraceDays()).toBe(3)
  })

  it('falls back to the default when the setting is missing', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue(null)
    expect(await getUnverifiedGraceDays()).toBe(DEFAULT_UNVERIFIED_GRACE_DAYS)
  })

  it('falls back to the default when the value is zero or negative', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({ key: 'unverified_purge_days', value: 0 } as never)
    expect(await getUnverifiedGraceDays()).toBe(DEFAULT_UNVERIFIED_GRACE_DAYS)
  })
})
