import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn() } } }))
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() } }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn().mockResolvedValue(true) } }))

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { authorizeCredentials } from './authorize'

const baseUser = {
  id: 'u1', email: 'a@b.com', role: 'user', locale: 'en',
  passwordHash: 'h', emailVerified: new Date(),
  totpEnabled: false, requiresMfa: false,
}

beforeEach(() => { vi.clearAllMocks(); vi.mocked(redis.incr).mockResolvedValue(1) })

describe('authorizeCredentials — password path', () => {
  it('returns null when the account has TOTP enabled (must use the verified-token path)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, totpEnabled: true } as never)
    expect(await authorizeCredentials({ email: 'a@b.com', password: 'secret-password' })).toBeNull()
  })
  it('returns null when requiresMfa is set but TOTP is not yet enabled', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, requiresMfa: true, totpEnabled: false } as never)
    expect(await authorizeCredentials({ email: 'a@b.com', password: 'secret-password' })).toBeNull()
  })
  it('returns the user when no MFA is configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never)
    expect(await authorizeCredentials({ email: 'a@b.com', password: 'secret-password' })).toMatchObject({ id: 'u1', email: 'a@b.com' })
  })
})

describe('authorizeCredentials — per-account throttle', () => {
  it('returns null without checking the password once the email is locked', async () => {
    vi.mocked(redis.incr).mockResolvedValue(11)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never)
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'whatever-password' })
    expect(result).toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })
})
