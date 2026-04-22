import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long!!'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    integration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}))

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { encrypt } from '@/lib/encryption'

describe('getIntegrationConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no row exists', async () => {
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(null)
    const { getIntegrationConfig } = await import('./integrations')
    expect(await getIntegrationConfig('mailgun')).toBeNull()
  })

  it('returns decrypted config from DB', async () => {
    const config = { apiKey: 'key123', domain: 'mg.example.com', from: 'Test <t@t.com>', region: 'eu' }
    vi.mocked(prisma.integration.findUnique).mockResolvedValue({
      id: '1', provider: 'mailgun',
      encryptedConfig: encrypt(JSON.stringify(config)),
      status: 'ok', lastTestedAt: null, lastError: null,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { getIntegrationConfig } = await import('./integrations')
    expect(await getIntegrationConfig('mailgun')).toEqual(config)
  })

  it('returns cached value from Redis without hitting DB', async () => {
    const config = { apiKey: 'cached', domain: 'mg.example.com', from: 'T <t@t.com>', region: 'eu' }
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(config))
    const { getIntegrationConfig } = await import('./integrations')
    const result = await getIntegrationConfig('mailgun')
    expect(result).toEqual(config)
    expect(prisma.integration.findUnique).not.toHaveBeenCalled()
  })
})

describe('saveIntegrationConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts encrypted config and clears cache', async () => {
    vi.mocked(prisma.integration.upsert).mockResolvedValue({} as any)
    const { saveIntegrationConfig } = await import('./integrations')
    await saveIntegrationConfig('mailgun', { apiKey: 'k', domain: 'd', from: 'f', region: 'eu' })
    expect(prisma.integration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'mailgun' },
      })
    )
    expect(redis.del).toHaveBeenCalledWith('integration:mailgun')
  })
})
