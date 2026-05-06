import { describe, it, expect } from 'vitest'
import { computeScoreRecords } from './scoreRecords'
import type { AggregatorGame } from './types'

function game(scores: { playerId: string; name: string; score: number }[], playedAt = '2026-04-20T00:00:00Z'): AggregatorGame {
  const sorted = scores.slice().sort((a, b) => b.score - a.score)
  return {
    id: Math.random().toString(), playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: sorted.map((s, i) => ({
      playerId: s.playerId, score: s.score, isWinner: i === 0,
      player: { id: s.playerId, name: s.name, avatarSeed: s.playerId, linkedUserId: null },
    })),
  }
}

describe('computeScoreRecords', () => {
  it('returns highest, highestLoss, average winner', () => {
    const games = [
      game([{ playerId: 'p1', name: 'A', score: 100 }, { playerId: 'p2', name: 'B', score: 80 }]),
      game([{ playerId: 'p1', name: 'A', score: 40 }, { playerId: 'p2', name: 'B', score: 90 }]),
    ]
    const r = computeScoreRecords(games)
    expect(r.highest?.score).toBe(100)
    expect(r.highest?.playerName).toBe('A')
    expect(r.highestLoss?.score).toBe(80)
    expect(r.averageWinner).toBe(95)
  })

  it('null fields when no games', () => {
    expect(computeScoreRecords([])).toEqual({ highest: null, highestLoss: null, averageWinner: null })
  })
})
