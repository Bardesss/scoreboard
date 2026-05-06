import { describe, it, expect } from 'vitest'
import { computeHeadToHead } from './headToHead'
import type { AggregatorGame, AggregatorMember } from './types'

function g(scores: { playerId: string; score: number }[]): AggregatorGame {
  const sorted = scores.slice().sort((a, b) => b.score - a.score)
  return {
    id: Math.random().toString(), playedAt: new Date(),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: sorted.map((s, i) => ({
      playerId: s.playerId, score: s.score, isWinner: i === 0,
      player: { id: s.playerId, name: s.playerId, avatarSeed: s.playerId, linkedUserId: null },
    })),
  }
}

const members: AggregatorMember[] = [
  { playerId: 'p1', name: 'Alice', avatarSeed: 'p1', linkedUserId: null },
  { playerId: 'p2', name: 'Bob',   avatarSeed: 'p2', linkedUserId: null },
  { playerId: 'p3', name: 'Carol', avatarSeed: 'p3', linkedUserId: null },
]

describe('computeHeadToHead', () => {
  it('returns N×N matrix with zero diagonal', () => {
    const m = computeHeadToHead([], members)
    expect(m.players).toHaveLength(3)
    expect(m.cells).toHaveLength(3)
    expect(m.cells.every((r, i) => r[i] === 0)).toBe(true)
  })

  it('counts A>B pairs correctly', () => {
    const games = [
      g([{ playerId: 'p1', score: 10 }, { playerId: 'p2', score: 5 }, { playerId: 'p3', score: 3 }]),
      g([{ playerId: 'p2', score: 7 }, { playerId: 'p1', score: 4 }]),
    ]
    const m = computeHeadToHead(games, members)
    const idx = (pid: string) => m.players.findIndex(p => p.id === pid)
    expect(m.cells[idx('p1')][idx('p2')]).toBe(1)
    expect(m.cells[idx('p2')][idx('p1')]).toBe(1)
    expect(m.cells[idx('p1')][idx('p3')]).toBe(1)
  })
})
