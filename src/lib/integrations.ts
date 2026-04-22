import { prisma } from './prisma'
import { redis } from './redis'
import { encrypt, decrypt } from './encryption'

export type IntegrationProvider = 'mailgun' | 'mollie' | 'stripe' | 'strike'

const CACHE_TTL = 300 // 5 minutes

export async function getIntegrationConfig(provider: IntegrationProvider): Promise<Record<string, string> | null> {
  const cacheKey = `integration:${provider}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as Record<string, string>

  const row = await prisma.integration.findUnique({ where: { provider } })
  if (!row) return null

  try {
    const config = JSON.parse(decrypt(row.encryptedConfig)) as Record<string, string>
    await redis.set(cacheKey, JSON.stringify(config), 'EX', CACHE_TTL)
    return config
  } catch {
    return null
  }
}

export async function saveIntegrationConfig(
  provider: IntegrationProvider,
  config: Record<string, string>
): Promise<void> {
  const encryptedConfig = encrypt(JSON.stringify(config))
  await prisma.integration.upsert({
    where: { provider },
    create: { provider, encryptedConfig, status: 'unconfigured' },
    update: { encryptedConfig, status: 'unconfigured', lastError: null },
  })
  await redis.del(`integration:${provider}`)
}

export async function setIntegrationStatus(
  provider: IntegrationProvider,
  status: 'ok' | 'error',
  error?: string
): Promise<void> {
  await prisma.integration.update({
    where: { provider },
    data: { status, lastError: error ?? null, lastTestedAt: new Date() },
  })
}
