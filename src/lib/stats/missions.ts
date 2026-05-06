import type { AggregatorGame, MissionStat } from './types'

export function computeMissionStats(games: AggregatorGame[]): MissionStat[] | null {
  const counts: Record<string, number> = {}
  let any = false
  for (const g of games) {
    if (g.winningMission) {
      counts[g.winningMission] = (counts[g.winningMission] ?? 0) + 1
      any = true
    }
  }
  if (!any) return null
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
