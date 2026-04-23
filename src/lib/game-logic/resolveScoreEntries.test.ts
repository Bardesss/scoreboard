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

describe('team', () => {
  const templ = () => template({ winType: 'team' })
  const base = (overrides: Partial<ResolverInput>) =>
    input({ participantIds: ['p1', 'p2', 'p3', 'p4'], ...overrides })

  it('requires team assignment for every participant', () => {
    expect(resolveScoreEntries(templ(), base({
      teams: ['Red', 'Blue'],
      teamAssignments: { p1: 'Red' },
      winningTeam: 'Red',
    }))).toEqual({ ok: false, error: 'missingTeamAssignment' })
  })

  it('requires winningTeam to be a listed team', () => {
    expect(resolveScoreEntries(templ(), base({
      teams: ['Red', 'Blue'],
      teamAssignments: { p1: 'Red', p2: 'Red', p3: 'Blue', p4: 'Blue' },
      winningTeam: 'Green',
    }))).toEqual({ ok: false, error: 'missingWinningTeam' })
  })

  it('everyone on winning team gets isWinner', () => {
    const r = resolveScoreEntries(templ(), base({
      teams: ['Red', 'Blue'],
      teamAssignments: { p1: 'Red', p2: 'Red', p3: 'Blue', p4: 'Blue' },
      winningTeam: 'Red',
    }))
    expect(r.ok).toBe(true); if (!r.ok) return
    const byId = Object.fromEntries(r.scoreEntries.map(e => [e.playerId, e]))
    expect(byId.p1).toMatchObject({ team: 'Red', isWinner: true })
    expect(byId.p2).toMatchObject({ team: 'Red', isWinner: true })
    expect(byId.p3).toMatchObject({ team: 'Blue', isWinner: false })
    expect(byId.p4).toMatchObject({ team: 'Blue', isWinner: false })
    expect(r.extras.teams).toEqual(['Red', 'Blue'])
    expect(r.extras.teamScores).toBeNull()
  })

  it('records teamScores when trackTeamScores', () => {
    const r = resolveScoreEntries(
      template({ winType: 'team', trackTeamScores: true }),
      base({
        teams: ['Red', 'Blue'],
        teamAssignments: { p1: 'Red', p2: 'Red', p3: 'Blue', p4: 'Blue' },
        winningTeam: 'Red',
        perTeamScores: { Red: 12, Blue: 8 },
      }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.extras.teamScores).toEqual([{ name: 'Red', score: 12 }, { name: 'Blue', score: 8 }])
  })
})

describe('cooperative', () => {
  it('requires cooperativeWon boolean', () => {
    expect(resolveScoreEntries(
      template({ winType: 'cooperative' }),
      input({}),
    )).toEqual({ ok: false, error: 'missingCooperativeResult' })
  })

  it('all participants win when team wins', () => {
    const r = resolveScoreEntries(
      template({ winType: 'cooperative' }),
      input({ cooperativeWon: true }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.every(s => s.isWinner && s.score === 1)).toBe(true)
  })

  it('all participants lose when team loses', () => {
    const r = resolveScoreEntries(
      template({ winType: 'cooperative' }),
      input({ cooperativeWon: false }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.every(s => !s.isWinner && s.score === 0)).toBe(true)
  })

  it('records difficulty when trackDifficulty', () => {
    const r = resolveScoreEntries(
      template({ winType: 'cooperative', trackDifficulty: true }),
      input({ cooperativeWon: true, difficulty: 'hard' }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.extras.difficulty).toBe('hard')
  })

  it('ignores difficulty field when trackDifficulty=false', () => {
    const r = resolveScoreEntries(
      template({ winType: 'cooperative', trackDifficulty: false }),
      input({ cooperativeWon: true, difficulty: 'hard' }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.extras.difficulty).toBeNull()
  })
})

describe('elimination', () => {
  it('without order: requires winnerId, score 1/0', () => {
    expect(resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: false }),
      input({}),
    )).toEqual({ ok: false, error: 'missingWinner' })

    const r = resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: false }),
      input({ winnerId: 'p1' }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.isWinner).toBe(true)
    expect(r.scoreEntries.find(s => s.playerId === 'p1')!.eliminationOrder).toBeNull()
  })

  it('with order: player with null order is winner', () => {
    const r = resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: true }),
      input({
        participantIds: ['p1', 'p2', 'p3'],
        perPlayerEliminationOrder: { p1: 1, p2: null, p3: 2 },
      }),
    )
    expect(r.ok).toBe(true); if (!r.ok) return
    const byId = Object.fromEntries(r.scoreEntries.map(e => [e.playerId, e]))
    expect(byId.p2).toMatchObject({ isWinner: true, eliminationOrder: null, score: 1 })
    expect(byId.p1).toMatchObject({ isWinner: false, eliminationOrder: 1, score: 0 })
    expect(byId.p3).toMatchObject({ isWinner: false, eliminationOrder: 2, score: 0 })
  })

  it('with order: rejects more than one null, non-unique orders, out-of-range', () => {
    expect(resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: true }),
      input({ participantIds: ['p1', 'p2'], perPlayerEliminationOrder: { p1: null, p2: null } }),
    )).toEqual({ ok: false, error: 'invalidEliminationOrder' })

    expect(resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: true }),
      input({ participantIds: ['p1', 'p2', 'p3'], perPlayerEliminationOrder: { p1: 1, p2: 1, p3: null } }),
    )).toEqual({ ok: false, error: 'invalidEliminationOrder' })

    expect(resolveScoreEntries(
      template({ winType: 'elimination', trackEliminationOrder: true }),
      input({ participantIds: ['p1', 'p2'], perPlayerEliminationOrder: { p1: 5, p2: null } }),
    )).toEqual({ ok: false, error: 'invalidEliminationOrder' })
  })
})

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
