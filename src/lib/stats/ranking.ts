import type { AggregatorGame, RankingEntry } from './types'

export function computeRanking(games: AggregatorGame[], viewerId: string | undefined): RankingEntry[] {
  const byPlayer: Record<string, {
    playerId: string; name: string; avatarSeed: string; linkedUserId: string | null
    wins: number; gamesPlayed: number
  }> = {}

  for (const g of games) {
    for (const s of g.scores) {
      if (!byPlayer[s.playerId]) {
        byPlayer[s.playerId] = {
          playerId: s.playerId, name: s.player.name, avatarSeed: s.player.avatarSeed,
          linkedUserId: s.player.linkedUserId,
          wins: 0, gamesPlayed: 0,
        }
      }
      byPlayer[s.playerId].gamesPlayed++
    }
    // Use ScoreEntry.isWinner as the source of truth — supports all win types
    // (points-winner, points-all, time, cooperative, team, ranking).
    for (const s of g.scores) {
      if (s.isWinner && byPlayer[s.playerId]) byPlayer[s.playerId].wins++
    }
  }

  return Object.values(byPlayer)
    .map(p => ({
      playerId: p.playerId,
      name: p.name,
      avatarSeed: p.avatarSeed,
      wins: p.wins,
      gamesPlayed: p.gamesPlayed,
      winRatio: p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0,
      // The "me" player linked to viewer's user account — NOT vault ownership.
      isCurrentUser: viewerId != null && p.linkedUserId === viewerId,
    }))
    .sort((a, b) => b.wins - a.wins || b.winRatio - a.winRatio)
    .slice(0, 10)
}
