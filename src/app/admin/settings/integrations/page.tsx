import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { getIntegrationConfig } from '@/lib/integrations'
import IntegrationsClient from './IntegrationsClient'
import type { MailgunStats } from './actions'
import { umamiConfigured } from '@/lib/umami'

export default async function IntegrationsPage() {
  const rows = await prisma.integration.findMany({
    select: { provider: true, status: true, lastTestedAt: true, lastError: true },
  })

  const byProvider = Object.fromEntries(rows.map(r => [r.provider, r]))

  const cachedStats = await redis.get('integration:mailgun:stats')
  const mailgunStats: MailgunStats | null = cachedStats ? JSON.parse(cachedStats) : null

  const mailgun = byProvider['mailgun'] ?? null
  const mailgunConfig = mailgun ? await getIntegrationConfig('mailgun') : null

  return (
    <IntegrationsClient
      mailgun={mailgun ? {
        status: mailgun.status,
        lastTestedAt: mailgun.lastTestedAt?.toISOString() ?? null,
        lastError: mailgun.lastError,
        apiKey: mailgunConfig?.apiKey ?? '',
        domain: mailgunConfig?.domain ?? '',
        from: mailgunConfig?.from ?? '',
        region: mailgunConfig?.region === 'us' ? 'us' : 'eu',
      } : null}
      mailgunStats={mailgunStats}
      umami={{ configured: umamiConfigured() }}
    />
  )
}
