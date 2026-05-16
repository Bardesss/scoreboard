import { describe, it, expect } from 'vitest'
import { computeTotalPoints } from './totalPoints'
import type { AggregatorGame } from './types'

function game(scores: { playerId: string; name: string; score: number; linkedUserId?: string | null }[]): AggregatorGame {
  const sorted = scores.slice().sort((a, b) => b.score - a.score)
  return {
    id: Math.random().toString(),
    playedAt: new Date('2026-04-20T00:00:00Z'),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: sorted.map((s, i) => ({
      playerId: s.playerId, score: s.score, isWinner: i === 0,
      player: { id: s.playerId, name: s.name, avatarSeed: s.playerId, linkedUserId: s.linkedUserId ?? null },
    })),
  }
}

describe('computeTotalPoints', () => {
  it('sums scores per player and sorts descending', () => {
    const games = [
      game([{ playerId: 'p1', name: 'A', score: 100 }, { playerId: 'p2', name: 'B', score: 80 }]),
      game([{ playerId: 'p1', name: 'A', score: 40 }, { playerId: 'p2', name: 'B', score: 90 }]),
    ]
    const r = computeTotalPoints(games, undefined)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ playerId: 'p2', totalPoints: 170, gamesPlayed: 2 })
    expect(r[1]).toMatchObject({ playerId: 'p1', totalPoints: 140, gamesPlayed: 2 })
  })

  it('marks isCurrentUser via player.linkedUserId === viewerId', () => {
    const games = [game([{ playerId: 'p1', name: 'A', score: 10, linkedUserId: 'u1' }])]
    const r = computeTotalPoints(games, 'u1')
    expect(r[0].isCurrentUser).toBe(true)
  })

  it('returns empty for no games', () => {
    expect(computeTotalPoints([], undefined)).toEqual([])
  })

  it('counts each game once per player even with multiple scores', () => {
    const games = [
      game([{ playerId: 'p1', name: 'A', score: 5 }, { playerId: 'p2', name: 'B', score: 3 }]),
      game([{ playerId: 'p1', name: 'A', score: 7 }]),
    ]
    const r = computeTotalPoints(games, undefined)
    const a = r.find(x => x.playerId === 'p1')!
    expect(a.gamesPlayed).toBe(2)
    expect(a.totalPoints).toBe(12)
  })
})
