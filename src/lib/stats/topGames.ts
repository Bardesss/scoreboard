import type { AggregatorGame, TopGame } from './types'

export function computeTopGames(games: AggregatorGame[], viewerId: string | undefined): TopGame[] {
  const byTemplate: Record<string, { count: number; userWins: number; userGames: number }> = {}

  for (const g of games) {
    const name = g.league.gameTemplate.name
    if (!byTemplate[name]) byTemplate[name] = { count: 0, userWins: 0, userGames: 0 }
    byTemplate[name].count++
    const winner = g.scores[0]
    for (const s of g.scores) {
      if (viewerId != null && s.player.userId === viewerId) {
        byTemplate[name].userGames++
        if (winner && s.playerId === winner.playerId) byTemplate[name].userWins++
      }
    }
  }

  return Object.entries(byTemplate)
    .map(([name, t]) => ({
      name,
      count: t.count,
      userWinRatio: t.userGames > 0 ? Math.round((t.userWins / t.userGames) * 100) : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}
