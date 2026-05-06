import { describe, it, expect } from 'vitest'
import { computeRecentForm } from './recentForm'
import type { AggregatorGame, AggregatorMember } from './types'

function game(playedAt: string, scores: { playerId: string; score: number; linkedUserId?: string | null }[]): AggregatorGame {
  const sorted = scores.slice().sort((a, b) => b.score - a.score)
  return {
    id: playedAt, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: sorted.map((s, i) => ({
      playerId: s.playerId, score: s.score, isWinner: i === 0,
      player: { id: s.playerId, name: s.playerId, avatarSeed: s.playerId, linkedUserId: s.linkedUserId ?? null },
    })),
  }
}

describe('computeRecentForm', () => {
  it('returns last 5 W/L in newest-first order', () => {
    const members: AggregatorMember[] = [
      { playerId: 'p1', name: 'A', avatarSeed: 'p1', linkedUserId: 'u1' },
      { playerId: 'p2', name: 'B', avatarSeed: 'p2', linkedUserId: null },
    ]
    const games = [
      game('2026-04-01', [{ playerId: 'p1', score: 10 }, { playerId: 'p2', score: 5 }]),
      game('2026-04-02', [{ playerId: 'p2', score: 9 }, { playerId: 'p1', score: 3 }]),
      game('2026-04-03', [{ playerId: 'p1', score: 8 }, { playerId: 'p2', score: 7 }]),
    ]
    const rows = computeRecentForm(games, members, 'u1')!
    const alice = rows.find(r => r.playerId === 'p1')!
    expect(alice.results).toEqual(['W', 'L', 'W'])
    expect(alice.isCurrentUser).toBe(true)
  })
})
