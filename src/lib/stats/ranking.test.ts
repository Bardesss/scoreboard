import { describe, it, expect } from 'vitest'
import { computeRanking } from './ranking'
import type { AggregatorGame } from './types'

function game(
  id: string,
  scores: { playerId: string; name: string; score: number; linkedUserId?: string | null }[],
): AggregatorGame {
  const sorted = scores.slice().sort((a, b) => b.score - a.score)
  return {
    id, playedAt: new Date(), winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'League', gameTemplate: { name: 'G', missions: [] } },
    scores: sorted.map((s, i) => ({
      playerId: s.playerId,
      score: s.score,
      // In these test fixtures top scorer is the winner (points-winner semantics).
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

describe('computeRanking', () => {
  it('returns empty array for no games', () => {
    expect(computeRanking([], undefined)).toEqual([])
  })

  it('counts wins and games played', () => {
    const games = [
      game('g1', [{ playerId: 'p1', name: 'Alice', score: 10 }, { playerId: 'p2', name: 'Bob', score: 8 }]),
      game('g2', [{ playerId: 'p1', name: 'Alice', score: 5 }, { playerId: 'p2', name: 'Bob', score: 12 }]),
    ]
    const ranking = computeRanking(games, undefined)
    expect(ranking).toHaveLength(2)
    expect(ranking[0]).toMatchObject({ name: 'Alice', wins: 1, gamesPlayed: 2, winRatio: 50 })
    expect(ranking[1]).toMatchObject({ name: 'Bob', wins: 1, gamesPlayed: 2, winRatio: 50 })
  })

  it('marks isCurrentUser when viewerId matches player.linkedUserId', () => {
    const games = [game('g1', [{ playerId: 'p1', name: 'Alice', score: 10, linkedUserId: 'u1' }])]
    const r = computeRanking(games, 'u1')
    expect(r[0].isCurrentUser).toBe(true)
  })

  it('sorts by wins desc, caps to 10', () => {
    const games = Array.from({ length: 12 }, (_, i) =>
      game(`g${i}`, [{ playerId: `p${i}`, name: `P${i}`, score: 10 }])
    )
    const r = computeRanking(games, undefined)
    expect(r).toHaveLength(10)
    expect(r[0].wins).toBe(1)
  })
})
