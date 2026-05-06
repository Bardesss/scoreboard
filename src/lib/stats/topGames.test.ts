import { describe, it, expect } from 'vitest'
import { computeTopGames } from './topGames'
import type { AggregatorGame } from './types'

function game(
  templateName: string,
  scores: { playerId: string; name: string; score: number; linkedUserId?: string | null }[],
): AggregatorGame {
  const sorted = scores.slice().sort((a, b) => b.score - a.score)
  return {
    id: Math.random().toString(), playedAt: new Date(), winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: templateName, missions: [] } },
    scores: sorted.map((s, i) => ({
      playerId: s.playerId,
      score: s.score,
      // Top scorer is winner in these test fixtures.
      isWinner: i === 0,
      player: {
        id: s.playerId,
        name: s.name,
        avatarSeed: s.playerId,
        linkedUserId: s.linkedUserId ?? null,
      },
    })),
  }
}

describe('computeTopGames', () => {
  it('counts plays per template and user winRatio', () => {
    const games = [
      game('Catan', [{ playerId: 'p1', name: 'A', score: 10, linkedUserId: 'u1' }, { playerId: 'p2', name: 'B', score: 5 }]),
      game('Catan', [{ playerId: 'p1', name: 'A', score: 3, linkedUserId: 'u1' }, { playerId: 'p2', name: 'B', score: 9 }]),
      game('Ticket', [{ playerId: 'p1', name: 'A', score: 40, linkedUserId: 'u1' }]),
    ]
    const top = computeTopGames(games, 'u1')
    expect(top[0]).toEqual({ name: 'Catan', count: 2, userWinRatio: 50 })
    expect(top[1]).toEqual({ name: 'Ticket', count: 1, userWinRatio: 100 })
  })

  it('userWinRatio null when user has no scores in template', () => {
    const games = [game('Catan', [{ playerId: 'p2', name: 'B', score: 10 }])]
    expect(computeTopGames(games, 'u1')[0].userWinRatio).toBeNull()
  })
})
