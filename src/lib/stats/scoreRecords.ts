import type { AggregatorGame, ScoreRecords } from './types'

export function computeScoreRecords(games: AggregatorGame[]): ScoreRecords {
  if (games.length === 0) return { highest: null, highestLoss: null, averageWinner: null }

  let highest: ScoreRecords['highest'] = null
  let highestLoss: ScoreRecords['highestLoss'] = null
  let winnerSum = 0
  let winnerCount = 0

  for (const g of games) {
    const playedAt = g.playedAt.toISOString()
    for (const s of g.scores) {
      if (!highest || s.score > highest.score) {
        highest = { playerName: s.player.name, score: s.score, playedAt }
      }
      if (s.isWinner) {
        // Average across ALL winners (handles team mode with multiple winners).
        winnerSum += s.score
        winnerCount++
      } else {
        // Highest loss = highest score among non-winners (every game has multiple non-winners).
        if (!highestLoss || s.score > highestLoss.score) {
          highestLoss = { playerName: s.player.name, score: s.score, playedAt }
        }
      }
    }
  }

  return {
    highest,
    highestLoss,
    averageWinner: winnerCount > 0 ? Math.round(winnerSum / winnerCount) : null,
  }
}
