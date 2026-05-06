import { describe, it, expect } from 'vitest'
import { computeLeagues } from './leagues'
import type { AggregatorGame } from './types'

function g(leagueId: string, playedAt: string): AggregatorGame {
  return {
    id: `${leagueId}-${playedAt}`, playedAt: new Date(playedAt),
    winningMission: null, notes: null, shareToken: null,
    league: { id: leagueId, name: `League ${leagueId}`, gameTemplate: { name: 'G', missions: [] } },
    scores: [],
  }
}

describe('computeLeagues', () => {
  it('joins league list with played-games aggregation', () => {
    const allLeagues = [
      { id: 'l1', name: 'L1', playerCount: 3 },
      { id: 'l2', name: 'L2', playerCount: 5 },
    ]
    const games = [
      g('l1', '2026-04-20T10:00:00Z'),
      g('l1', '2026-04-21T10:00:00Z'),
    ]
    const result = computeLeagues(allLeagues, games)
    expect(result[0]).toMatchObject({ id: 'l1', sessionCount: 2 })
    expect(result[0].lastPlayedAt).toBe('2026-04-21T10:00:00.000Z')
    expect(result[1]).toMatchObject({ id: 'l2', sessionCount: 0, lastPlayedAt: null })
  })
})
