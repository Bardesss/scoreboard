import type { AggregatorGame, AggregatorMember, StreakEntry } from './types'

export function computeStreaks(games: AggregatorGame[], members: AggregatorMember[]): StreakEntry[] | null {
  if (games.length === 0) return []
  const sorted = [...games].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())
  const playerWins: Record<string, boolean[]> = {}
  for (const g of sorted) {
    for (const s of g.scores) {
      if (!playerWins[s.playerId]) playerWins[s.playerId] = []
      // isWinner is the source of truth (handles team/coop/time/ranking win-types).
      playerWins[s.playerId].push(s.isWinner)
    }
  }
  const entries: StreakEntry[] = []
  for (const m of members) {
    const results = playerWins[m.playerId] ?? []
    if (!results.some(Boolean)) continue
    let longest = 0, run = 0, current = 0
    for (const w of results) { if (w) { run++; longest = Math.max(longest, run) } else run = 0 }
    for (let i = results.length - 1; i >= 0; i--) { if (results[i]) current++; else break }
    entries.push({ playerId: m.playerId, name: m.name, avatarSeed: m.avatarSeed, currentStreak: current, longestStreak: longest })
  }
  return entries.sort((a, b) => b.longestStreak - a.longestStreak || b.currentStreak - a.currentStreak)
}
