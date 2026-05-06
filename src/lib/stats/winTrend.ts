import type { AggregatorGame, AggregatorMember, WinTrendSeries } from './types'

const PALETTE = ['#f5a623', '#1e8e6f', '#7a4fc2', '#c83f5c', '#2a6cb3']

function colorFor(_seed: string, index: number): string {
  return PALETTE[index % PALETTE.length]
}

export function computeWinTrend(games: AggregatorGame[], members: AggregatorMember[]): WinTrendSeries | null {
  if (games.length === 0) return null
  const sorted = [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())

  // Count total wins per player using isWinner (handles team mode w/ multiple winners).
  const totalWins: Record<string, number> = {}
  for (const g of sorted) {
    for (const s of g.scores) {
      if (s.isWinner) totalWins[s.playerId] = (totalWins[s.playerId] ?? 0) + 1
    }
  }

  const topIds = Object.entries(totalWins)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const top = topIds
    .map((id, i) => {
      const m = members.find(x => x.playerId === id)
      if (!m) return null
      return { id, name: m.name, color: colorFor(m.avatarSeed, i) }
    })
    .filter((x): x is { id: string; name: string; color: string } => x !== null)

  if (top.length === 0) return null

  const running: Record<string, number> = {}
  top.forEach(p => { running[p.id] = 0 })
  const points: WinTrendSeries['points'] = []
  sorted.forEach((g, i) => {
    for (const s of g.scores) {
      if (s.isWinner && running[s.playerId] !== undefined) running[s.playerId]++
    }
    points.push({ gameIndex: i + 1, ...running })
  })

  return { players: top, points }
}
