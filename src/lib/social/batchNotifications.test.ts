import { describe, it, expect } from 'vitest'
import { batchConnectionGameLogged, type RawNotification } from '@/lib/social/batchNotifications'

const make = (id: string, type: string, meta: Record<string, unknown>, createdAt: string, read = false): RawNotification => ({
  id, type, meta, read, createdAt,
})

describe('batchConnectionGameLogged', () => {
  it('leaves other types untouched', () => {
    const input = [make('a', 'connection_request', {}, '2026-05-19T10:00:00Z')]
    expect(batchConnectionGameLogged(input)).toEqual(input)
  })

  it('does not collapse a single connection_game_logged', () => {
    const input = [make('a', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X' }, '2026-05-19T10:00:00Z')]
    expect(batchConnectionGameLogged(input)).toEqual(input)
  })

  it('collapses 2+ same-league same-day into one synthetic row', () => {
    const input = [
      make('a', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X', playedGameId: 'g1' }, '2026-05-19T22:00:00Z'),
      make('b', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X', playedGameId: 'g2' }, '2026-05-19T10:00:00Z'),
      make('c', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X', playedGameId: 'g3' }, '2026-05-19T08:00:00Z'),
    ]
    const out = batchConnectionGameLogged(input)
    expect(out).toHaveLength(1)
    expect(out[0]?.type).toBe('connection_game_logged_batch')
    expect(out[0]?.meta).toMatchObject({ leagueId: 'l1', leagueName: 'X', count: 3, playedGameId: 'g1' })
  })

  it('does not merge across UTC days', () => {
    const input = [
      make('a', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X' }, '2026-05-19T22:00:00Z'),
      make('b', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X' }, '2026-05-20T01:00:00Z'),
    ]
    expect(batchConnectionGameLogged(input)).toEqual(input)
  })

  it('does not merge across different leagues', () => {
    const input = [
      make('a', 'connection_game_logged', { leagueId: 'l1', leagueName: 'X' }, '2026-05-19T10:00:00Z'),
      make('b', 'connection_game_logged', { leagueId: 'l2', leagueName: 'Y' }, '2026-05-19T11:00:00Z'),
    ]
    expect(batchConnectionGameLogged(input)).toEqual(input)
  })
})
