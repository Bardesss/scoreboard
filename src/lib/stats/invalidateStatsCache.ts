import { redis } from '@/lib/redis'

const RANGES = ['week', 'month', 'year', 'all'] as const

export async function invalidateStatsCache(params: {
  userIds: string[]
  leagueIds?: string[]
}): Promise<void> {
  const keys: string[] = []
  for (const uid of params.userIds) {
    for (const r of RANGES) keys.push(`cache:stats:user:${uid}:${r}`)
    // Backwards-compat: delete the legacy dashboard keys too
    keys.push(`cache:dashboard:stats:${uid}`)
    keys.push(`cache:dashboard:${uid}`)
  }
  for (const lid of params.leagueIds ?? []) {
    for (const r of RANGES) keys.push(`cache:stats:league:${lid}:${r}`)
  }
  if (keys.length > 0) await redis.del(...keys)
}
