import { describe, it, expect } from 'vitest'
import { computeGamesFrequency } from './gamesFrequency'
import type { AggregatorGame } from './types'

function g(playedAt: string): AggregatorGame {
  return {
    id: playedAt, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: [],
  }
}

describe('computeGamesFrequency', () => {
  it('buckets by week when range <= 2 months', () => {
    const games = [
      g('2026-04-20T10:00:00Z'),
      g('2026-04-21T10:00:00Z'),
      g('2026-04-14T10:00:00Z'),
    ]
    const buckets = computeGamesFrequency(games, {
      range: 'month', from: new Date('2026-04-01T00:00:00Z'), to: null,
    })
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(3)
    expect(Math.max(...buckets.map(b => b.count))).toBe(2)
  })

  it('buckets by month when range > 2 months or all', () => {
    const games = [g('2026-01-05T00:00:00Z'), g('2026-03-05T00:00:00Z'), g('2026-03-20T00:00:00Z')]
    const buckets = computeGamesFrequency(games, {
      range: 'all', from: null, to: null,
    })
    expect(buckets.find(b => b.count === 2)).toBeTruthy()
  })

  it('returns empty for no games', () => {
    expect(computeGamesFrequency([], { range: 'all', from: null, to: null })).toEqual([])
  })
})
