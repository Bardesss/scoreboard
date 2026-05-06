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

  it('uses UTC day-of-week (independent of process TZ)', () => {
    // 2026-04-19T22:00:00Z is Sunday UTC, but Monday in CET (+02:00).
    // Bucketing must use UTC day to be deterministic.
    const days = computePlayDays([g('2026-04-19T22:00:00Z')], 'nl')
    // Sunday count should be 1 (UTC), not Monday.
    const sunday = days.find(d => d.day === 0)!
    expect(sunday.count).toBe(1)
  })
})
