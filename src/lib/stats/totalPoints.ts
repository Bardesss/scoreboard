import type { AggregatorGame, TotalPointsEntry } from './types'

// Sum of every player's scores across all games. Only meaningful for win
// types where every participant records a numeric score on the same scale
// (i.e. winType === 'points-all'). Caller is responsible for that check —
// this function will happily sum nonsense if you feed it ranking or
// elimination data.
export function computeTotalPoints(
  games: AggregatorGame[],
  viewerId: string | undefined,
): TotalPointsEntry[] {
  const byPlayer = new Map<string, {
    name: string
    avatarSeed: string
    linkedUserId: string | null
    total: number
    played: number
  }>()

  for (const g of games) {
    for (const s of g.scores) {
      const existing = byPlayer.get(s.playerId)
      if (existing) {
        existing.total += s.score
        existing.played++
      } else {
        byPlayer.set(s.playerId, {
          name: s.player.name,
          avatarSeed: s.player.avatarSeed,
          linkedUserId: s.player.linkedUserId,
          total: s.score,
          played: 1,
        })
      }
    }
  }

  return Array.from(byPlayer.entries())
    .map(([playerId, p]) => ({
      playerId,
      name: p.name,
      avatarSeed: p.avatarSeed,
      totalPoints: p.total,
      gamesPlayed: p.played,
      isCurrentUser: viewerId != null && p.linkedUserId === viewerId,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.gamesPlayed - a.gamesPlayed)
}
