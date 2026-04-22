import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import IntegrationsClient from './IntegrationsClient'
import type { MailgunStats } from './actions'

export default async function IntegrationsPage() {
  const rows = await prisma.integration.findMany({
    select: { provider: true, status: true, lastTestedAt: true, lastError: true },
  })

  const byProvider = Object.fromEntries(rows.map(r => [r.provider, r]))

  const cachedStats = await redis.get('integration:mailgun:stats')
  const mailgunStats: MailgunStats | null = cachedStats ? JSON.parse(cachedStats) : null

  const mailgun = byProvider['mailgun'] ?? null

  return (
    <IntegrationsClient
      mailgun={mailgun ? {
        status: mailgun.status,
        lastTestedAt: mailgun.lastTestedAt?.toISOString() ?? null,
        lastError: mailgun.lastError,
      } : null}
      mailgunStats={mailgunStats}
    />
  )
}
