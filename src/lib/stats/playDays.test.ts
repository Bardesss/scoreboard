import { describe, it, expect } from 'vitest'
import { computePlayDays } from './playDays'
import type { AggregatorGame } from './types'

function g(playedAt: string): AggregatorGame {
  return {
    id: playedAt, playedAt: new Date(playedAt), winningMission: null, notes: null, shareToken: null,
    league: { id: 'L', name: 'L', gameTemplate: { name: 'G', missions: [] } },
    scores: [],
  }
}

describe('computePlayDays', () => {
  it('returns 7 entries, sorted by count desc', () => {
    const games = [g('2026-04-20T10:00:00Z'), g('2026-04-20T11:00:00Z'), g('2026-04-22T10:00:00Z')]
    const days = computePlayDays(games, 'nl')
    expect(days).toHaveLength(7)
    expect(days[0].count).toBeGreaterThanOrEqual(days[1].count)
    expect(days[0].count).toBe(2)
  })

  it('returns all zeros when no games', () => {
    const days = computePlayDays([], 'nl')
    expect(days.every(d => d.count === 0)).toBe(true)
    expect(days).toHaveLength(7)
  })
})
