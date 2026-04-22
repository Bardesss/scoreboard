'use server'

import { auth } from '@/lib/auth'
import { getIntegrationConfig, saveIntegrationConfig, setIntegrationStatus } from '@/lib/integrations'
import { redis } from '@/lib/redis'

async function assertAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorized')
}

export async function saveMailgunConfig(data: {
  apiKey: string
  domain: string
  from: string
  region: 'eu' | 'us'
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin()
    if (!data.apiKey || !data.domain || !data.from) {
      return { success: false, error: 'Alle velden zijn verplicht' }
    }
    await saveIntegrationConfig('mailgun', data)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export type MailgunStats = {
  domainState: string
  sent: number
  delivered: number
  failed: number
}

export async function testMailgunConnection(): Promise<{
  success: boolean
  error?: string
  stats?: MailgunStats
}> {
  try {
    await assertAdmin()

    const config = await getIntegrationConfig('mailgun')
    if (!config?.apiKey || !config?.domain) {
      return { success: false, error: 'Mailgun is nog niet geconfigureerd' }
    }

    const baseUrl = config.region === 'eu'
      ? 'https://api.eu.mailgun.net'
      : 'https://api.mailgun.net'

    const authHeader = `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`

    // Test domain connectivity
    const domainRes = await fetch(`${baseUrl}/v4/domains/${config.domain}`, {
      headers: { Authorization: authHeader },
    })

    if (!domainRes.ok) {
      const body = await domainRes.json().catch(() => ({}))
      const message = (body as any).message ?? `HTTP ${domainRes.status}`
      await setIntegrationStatus('mailgun', 'error', message)
      return { success: false, error: message }
    }

    const domainData = await domainRes.json() as { domain?: { state?: string } }
    const domainState = domainData.domain?.state ?? 'unknown'

    // Fetch 30-day stats
    const statsRes = await fetch(
      `${baseUrl}/v3/${config.domain}/stats/total?event=accepted&event=delivered&event=failed&duration=30d`,
      { headers: { Authorization: authHeader } }
    )

    let sent = 0
    let delivered = 0
    let failed = 0

    if (statsRes.ok) {
      const statsData = await statsRes.json() as {
        stats?: Array<{
          accepted?: { total?: number }
          delivered?: { total?: number }
          failed?: { total?: number }
        }>
      }
      for (const s of statsData.stats ?? []) {
        sent += s.accepted?.total ?? 0
        delivered += s.delivered?.total ?? 0
        failed += s.failed?.total ?? 0
      }
    }

    const stats: MailgunStats = { domainState, sent, delivered, failed }
    await redis.set('integration:mailgun:stats', JSON.stringify(stats), 'EX', 3600)
    await setIntegrationStatus('mailgun', 'ok')

    return { success: true, stats }
  } catch (e: any) {
    await setIntegrationStatus('mailgun', 'error', e.message).catch(() => {})
    return { success: false, error: e.message }
  }
}
