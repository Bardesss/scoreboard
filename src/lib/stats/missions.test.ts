import { describe, it, expect } from 'vitest'
import { computeMissionStats } from './missions'
import type { AggregatorGame } from './types'

function g(winningMission: string | null): AggregatorGame {
  return {
    id: Math.random().toString(), playedAt: new Date(),
    winningMission, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: ['A', 'B', 'C'] } },
    scores: [],
  }
}

describe('computeMissionStats', () => {
  it('returns null when no winningMission values anywhere', () => {
    expect(computeMissionStats([g(null), g(null)])).toBeNull()
    expect(computeMissionStats([])).toBeNull()
  })

  it('counts missions sorted desc', () => {
    const games = [g('A'), g('A'), g('B'), g(null), g('A'), g('C')]
    expect(computeMissionStats(games)).toEqual([
      { name: 'A', count: 3 },
      { name: 'B', count: 1 },
      { name: 'C', count: 1 },
    ])
  })
})
