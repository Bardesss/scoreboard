export type RawNotification = {
  id: string
  type: string
  meta: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

function utcDay(iso: string): string {
  return iso.slice(0, 10)
}

export function batchConnectionGameLogged(notifications: RawNotification[]): RawNotification[] {
  // First pass: group connection_game_logged by (leagueId, utcDay)
  const groups = new Map<string, RawNotification[]>()
  const keyOrder: string[] = []

  for (const n of notifications) {
    if (n.type !== 'connection_game_logged') continue
    const leagueId = String((n.meta ?? {}).leagueId ?? '')
    const key = `${leagueId}|${utcDay(n.createdAt)}`
    if (!groups.has(key)) {
      groups.set(key, [])
      keyOrder.push(key)
    }
    groups.get(key)!.push(n)
  }

  // Build a set of IDs that are part of a batch (2+)
  const batchedIds = new Set<string>()
  const batchResults = new Map<string, RawNotification>()

  for (const key of keyOrder) {
    const bucket = groups.get(key)!
    if (bucket.length < 2) continue
    bucket.forEach(n => batchedIds.add(n.id))
    const sorted = [...bucket].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const head = sorted[0]!
    batchResults.set(key, {
      id: `batch:${head.id}`,
      type: 'connection_game_logged_batch',
      meta: {
        ...(head.meta ?? {}),
        count: bucket.length,
        playedGameId: (head.meta ?? {}).playedGameId ?? null,
      },
      read: sorted.every(n => n.read),
      createdAt: head.createdAt,
    })
  }

  // If nothing was batched, return original array unchanged
  if (batchedIds.size === 0) return notifications

  // Second pass: rebuild output preserving order, replacing first occurrence of
  // each batch group with the synthetic row and skipping the rest
  const emittedKeys = new Set<string>()
  const out: RawNotification[] = []

  for (const n of notifications) {
    if (n.type !== 'connection_game_logged' || !batchedIds.has(n.id)) {
      out.push(n)
      continue
    }
    const leagueId = String((n.meta ?? {}).leagueId ?? '')
    const key = `${leagueId}|${utcDay(n.createdAt)}`
    if (!emittedKeys.has(key)) {
      emittedKeys.add(key)
      out.push(batchResults.get(key)!)
    }
    // else: skip — already emitted the batch row
  }

  return out
}
