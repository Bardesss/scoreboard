import { describe, it, expect } from 'vitest'
import { computeStreaks } from './streaks'
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

describe('computeStreaks', () => {
  it('computes current + longest streak per member', () => {
    const games = [
      game('2026-04-01', 'p1', 'p2'),
      game('2026-04-02', 'p1', 'p2'),
      game('2026-04-03', 'p2', 'p1'),
      game('2026-04-04', 'p1', 'p2'),
    ]
    const s = computeStreaks(games, members)!
    const alice = s.find(e => e.playerId === 'p1')!
    const bob = s.find(e => e.playerId === 'p2')!
    expect(alice.currentStreak).toBe(1)
    expect(alice.longestStreak).toBe(2)
    expect(bob.currentStreak).toBe(0)
    expect(bob.longestStreak).toBe(1)
  })

  it('filters members with zero wins', () => {
    const games = [game('2026-04-01', 'p1', 'p2')]
    const s = computeStreaks(games, members)
    expect(s!.find(e => e.playerId === 'p2')).toBeUndefined()
  })
})
