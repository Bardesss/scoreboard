import type { AggregatorGame, AggregatorMember, RecentFormRow } from './types'

export function computeRecentForm(
  games: AggregatorGame[],
  members: AggregatorMember[],
  viewerId: string | undefined,
): RecentFormRow[] | null {
  if (games.length === 0) return []
  const sortedDesc = [...games].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
  return members.map(m => {
    const results: ('W' | 'L')[] = []
    for (const g of sortedDesc) {
      const myScore = g.scores.find(s => s.playerId === m.playerId)
      if (!myScore) continue
      // isWinner is the source of truth (per-winType resolution).
      results.push(myScore.isWinner ? 'W' : 'L')
      if (results.length === 5) break
    }
    return {
      playerId: m.playerId,
      name: m.name,
      avatarSeed: m.avatarSeed,
      // linkedUserId is the "me" Player → User link (NOT vault `userId`).
      isCurrentUser: viewerId != null && m.linkedUserId === viewerId,
      results,
    }
  })
}
