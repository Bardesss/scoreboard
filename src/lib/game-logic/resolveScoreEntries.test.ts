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
