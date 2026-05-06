import { describe, it, expect } from 'vitest'
import { computeWinTrend } from './winTrend'
import type { AggregatorGame, AggregatorMember } from './types'

function game(playedAt: string, winnerId: string, otherId: string): AggregatorGame {
  return {
    id: playedAt, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: [
      { playerId: winnerId, score: 10, isWinner: true,
        player: { id: winnerId, name: winnerId, avatarSeed: winnerId, linkedUserId: null } },
      { playerId: otherId, score: 1, isWinner: false,
        player: { id: otherId, name: otherId, avatarSeed: otherId, linkedUserId: null } },
    ],
  }
}

const members: AggregatorMember[] = [
  { playerId: 'p1', name: 'Alice', avatarSeed: 'p1', linkedUserId: null },
  { playerId: 'p2', name: 'Bob', avatarSeed: 'p2', linkedUserId: null },
]

describe('computeWinTrend', () => {
  it('builds cumulative wins per top-5 player', () => {
    const games = [
      game('2026-04-01', 'p1', 'p2'),
      game('2026-04-02', 'p2', 'p1'),
      game('2026-04-03', 'p1', 'p2'),
    ]
    const trend = computeWinTrend(games, members)!
    expect(trend.players).toHaveLength(2)
    expect(trend.points).toHaveLength(3)
    expect(trend.points[0].gameIndex).toBe(1)
    expect(trend.points[2].p1).toBe(2)
    expect(trend.points[2].p2).toBe(1)
  })
})
