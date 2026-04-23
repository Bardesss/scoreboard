import { describe, it, expect } from 'vitest'
import { resolveScoreEntries } from './resolveScoreEntries'
import type { ResolverTemplate, ResolverInput } from './types'

function template(overrides: Partial<ResolverTemplate>): ResolverTemplate {
  return {
    winType: 'winner',
    winCondition: null,
    scoreFields: [],
    roles: [],
    missions: [],
    trackDifficulty: false,
    trackTeamScores: false,
    trackEliminationOrder: false,
    timeUnit: null,
    ...overrides,
  }
}

function input(overrides: Partial<ResolverInput>): ResolverInput {
  return { participantIds: ['p1', 'p2'], ...overrides }
}

// describe blocks appended per branch below

describe('ranking', () => {
  it('rank 1 is the winner, score is inverted for sort compat', () => {
    const r = resolveScoreEntries(
      template({ winType: 'ranking' }),
      input({ participantIds: ['p1', 'p2', 'p3'], perPlayerRank: { p1: 2, p2: 1, p3: 3 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    const byId = Object.fromEntries(r.scoreEntries.map(e => [e.playerId, e]))
    expect(byId.p2).toMatchObject({ rank: 1, isWinner: true, score: 3 })  // N+1-1 = 3
    expect(byId.p1).toMatchObject({ rank: 2, isWinner: false, score: 2 })
    expect(byId.p3).toMatchObject({ rank: 3, isWinner: false, score: 1 })
  })

  it('returns invalidRanks when ranks are not unique 1..N', () => {
    expect(resolveScoreEntries(
      template({ winType: 'ranking' }),
      input({ participantIds: ['p1', 'p2'], perPlayerRank: { p1: 1, p2: 1 } }),
    )).toEqual({ ok: false, error: 'invalidRanks' })

    expect(resolveScoreEntries(
      template({ winType: 'ranking' }),
      input({ participantIds: ['p1', 'p2'], perPlayerRank: { p1: 1, p2: 3 } }),
    )).toEqual({ ok: false, error: 'invalidRanks' })

    expect(resolveScoreEntries(
      template({ winType: 'ranking' }),
      input({ participantIds: ['p1', 'p2'], perPlayerRank: { p1: 1 } }),
    )).toEqual({ ok: false, error: 'invalidRanks' })
  })
})

describe('time', () => {
  it('fastest (lowest seconds) wins by default', () => {
    const r = resolveScoreEntries(
      template({ winType: 'time', timeUnit: 'mmss', winCondition: 'low' }),
      input({ perPlayerTimeSeconds: { p1: 270, p2: 340 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.isWinner).toBe(true)
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.score).toBe(270)
  })

  it('slowest wins when winCondition=high', () => {
    const r = resolveScoreEntries(
      template({ winType: 'time', winCondition: 'high' }),
      input({ perPlayerTimeSeconds: { p1: 270, p2: 340 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p2')!.isWinner).toBe(true)
  })

  it('ties share winner flag', () => {
    const r = resolveScoreEntries(
      template({ winType: 'time', winCondition: 'low' }),
      input({ perPlayerTimeSeconds: { p1: 300, p2: 300 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.every(s => s.isWinner)).toBe(true)
  })

  it('missing time returns error', () => {
    expect(resolveScoreEntries(
      template({ winType: 'time' }),
      input({ perPlayerTimeSeconds: { p1: 100 } }),
    )).toEqual({ ok: false, error: 'missingTime' })
  })
})

describe('points-winner', () => {
  it('requires winnerId', () => {
    expect(resolveScoreEntries(
      template({ winType: 'points-winner' }),
      input({ winnerScore: 47 }),
    )).toEqual({ ok: false, error: 'missingWinner' })
  })

  it('winner gets entered score, others 0', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-winner' }),
      input({ winnerId: 'p1', winnerScore: 47 }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')).toMatchObject({ score: 47, isWinner: true })
    expect(r.scoreEntries.find(s => s.playerId === 'p2')).toMatchObject({ score: 0, isWinner: false })
  })

  it('treats missing winnerScore as 0', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-winner' }),
      input({ winnerId: 'p1' }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.score).toBe(0)
  })
})

describe('points-all', () => {
  it('picks highest sum as winner (default winCondition high)', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-all', winCondition: 'high', scoreFields: ['resources', 'vp'] }),
      input({ perPlayerScores: { p1: 15, p2: 22 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p2')!.isWinner).toBe(true)
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.isWinner).toBe(false)
    expect(r.scoreEntries.find(s => s.playerId === 'p2')!.score).toBe(22)
  })

  it('picks lowest sum when winCondition=low', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-all', winCondition: 'low' }),
      input({ perPlayerScores: { p1: 5, p2: 12 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.isWinner).toBe(true)
  })

  it('ties share winner flag', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-all', winCondition: 'high' }),
      input({ perPlayerScores: { p1: 10, p2: 10 } }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.every(s => s.isWinner)).toBe(true)
  })

  it('returns missingScore when any participant has no score', () => {
    const r = resolveScoreEntries(
      template({ winType: 'points-all' }),
      input({ perPlayerScores: { p1: 10 } }),
    )
    expect(r).toEqual({ ok: false, error: 'missingScore' })
  })
})

describe('secret-mission', () => {
  it('requires winnerId and winningMission', () => {
    expect(resolveScoreEntries(
      template({ winType: 'secret-mission', missions: ['Flag', 'Citadel'] }),
      input({ winnerId: 'p1' }),
    )).toEqual({ ok: false, error: 'missingMission' })

    expect(resolveScoreEntries(
      template({ winType: 'secret-mission', missions: ['Flag'] }),
      input({ winningMission: 'Flag' }),
    )).toEqual({ ok: false, error: 'missingWinner' })
  })

  it('returns entries + winningMission in extras', () => {
    const r = resolveScoreEntries(
      template({ winType: 'secret-mission', missions: ['Flag'] }),
      input({ winnerId: 'p1', winningMission: 'Flag' }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.scoreEntries[0].isWinner).toBe(true)
    expect(r.extras.winningMission).toBe('Flag')
  })
})

describe('winner', () => {
  it('requires winnerId', () => {
    const r = resolveScoreEntries(template({ winType: 'winner' }), input({}))
    expect(r).toEqual({ ok: false, error: 'missingWinner' })
  })

  it('marks winner and losers correctly', () => {
    const r = resolveScoreEntries(
      template({ winType: 'winner' }),
      input({ winnerId: 'p1' }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.scoreEntries).toEqual([
      { playerId: 'p1', score: 1, isWinner: true, role: null, team: null, rank: null, eliminationOrder: null },
      { playerId: 'p2', score: 0, isWinner: false, role: null, team: null, rank: null, eliminationOrder: null },
    ])
    expect(r.extras).toEqual({ winningMission: null, difficulty: null, teams: [], teamScores: null })
  })

  it('attaches roles when rolesEnabled', () => {
    const r = resolveScoreEntries(
      template({ winType: 'winner', roles: ['Mage', 'Warrior'] }),
      input({ winnerId: 'p1', perPlayerRole: { p1: 'Mage', p2: 'Warrior' } }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.scoreEntries[0].role).toBe('Mage')
    expect(r.scoreEntries[1].role).toBe('Warrior')
  })
})
