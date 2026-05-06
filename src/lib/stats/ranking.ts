import type { AggregatorGame, RankingEntry } from './types'

export function computeRanking(games: AggregatorGame[], viewerId: string | undefined): RankingEntry[] {
  const byPlayer: Record<string, {
    playerId: string; name: string; avatarSeed: string; userId: string | null
    wins: number; gamesPlayed: number
  }> = {}

  for (const g of games) {
    for (const s of g.scores) {
      if (!byPlayer[s.playerId]) {
        byPlayer[s.playerId] = {
          playerId: s.playerId, name: s.player.name, avatarSeed: s.player.avatarSeed, userId: s.player.userId,
          wins: 0, gamesPlayed: 0,
        }
      }
      byPlayer[s.playerId].gamesPlayed++
    }
    const winner = g.scores[0]
    if (winner && byPlayer[winner.playerId]) byPlayer[winner.playerId].wins++
  }

  return Object.values(byPlayer)
    .map(p => ({
      playerId: p.playerId,
      name: p.name,
      avatarSeed: p.avatarSeed,
      wins: p.wins,
      gamesPlayed: p.gamesPlayed,
      winRatio: p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0,
      isCurrentUser: viewerId != null && p.userId === viewerId,
    }))
    .sort((a, b) => b.wins - a.wins || b.winRatio - a.winRatio)
    .slice(0, 10)
}
