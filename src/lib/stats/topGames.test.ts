import { describe, it, expect } from 'vitest'
import { computeTopGames } from './topGames'
import type { AggregatorGame } from './types'

function game(templateName: string, scores: { playerId: string; name: string; score: number; userId?: string | null }[]): AggregatorGame {
  return {
    id: Math.random().toString(), playedAt: new Date(), winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: templateName, missions: [] } },
    scores: scores.slice().sort((a, b) => b.score - a.score).map(s => ({
      playerId: s.playerId, score: s.score,
      player: { id: s.playerId, name: s.name, avatarSeed: s.playerId, userId: s.userId ?? null },
    })),
  }
}

describe('computeTopGames', () => {
  it('counts plays per template and user winRatio', () => {
    const games = [
      game('Catan', [{ playerId: 'p1', name: 'A', score: 10, userId: 'u1' }, { playerId: 'p2', name: 'B', score: 5 }]),
      game('Catan', [{ playerId: 'p1', name: 'A', score: 3, userId: 'u1' }, { playerId: 'p2', name: 'B', score: 9 }]),
      game('Ticket', [{ playerId: 'p1', name: 'A', score: 40, userId: 'u1' }]),
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
