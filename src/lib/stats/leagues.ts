import type { AggregatorGame, LeagueStat } from './types'

export function computeLeagues(
  allLeagues: { id: string; name: string; playerCount: number }[],
  games: AggregatorGame[],
): LeagueStat[] {
  const counts: Record<string, number> = {}
  const last: Record<string, string> = {}

  for (const g of games) {
    counts[g.league.id] = (counts[g.league.id] ?? 0) + 1
    const iso = g.playedAt.toISOString()
    if (!last[g.league.id] || iso > last[g.league.id]) last[g.league.id] = iso
  }

  return allLeagues
    .map(l => ({
      id: l.id,
      name: l.name,
      playerCount: l.playerCount,
      sessionCount: counts[l.id] ?? 0,
      lastPlayedAt: last[l.id] ?? null,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
}
