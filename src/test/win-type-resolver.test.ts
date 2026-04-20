import { describe, it, expect } from 'vitest'
import { resolveWinType } from '@/app/app/games/new/win-type-resolver'

describe('resolveWinType', () => {
  it('returns incomplete when q1 is null', () => {
    expect(resolveWinType({ q1: null, q2: null, q3: null }))
      .toEqual({ winType: null, rolesEnabled: false, isComplete: false })
  })

  it('resolves points-all directly from q1', () => {
    expect(resolveWinType({ q1: 'points-all', q2: null, q3: null }))
      .toEqual({ winType: 'points-all', rolesEnabled: false, isComplete: true })
  })

  it('resolves points-winner directly from q1', () => {
    expect(resolveWinType({ q1: 'points-winner', q2: null, q3: null }))
      .toEqual({ winType: 'points-winner', rolesEnabled: false, isComplete: true })
  })

  it('resolves time directly from q1', () => {
    expect(resolveWinType({ q1: 'time', q2: null, q3: null }))
      .toEqual({ winType: 'time', rolesEnabled: false, isComplete: true })
  })

  it('resolves ranking directly from q1', () => {
    expect(resolveWinType({ q1: 'ranking', q2: null, q3: null }))
      .toEqual({ winType: 'ranking', rolesEnabled: false, isComplete: true })
  })

  it('resolves elimination directly from q1', () => {
    expect(resolveWinType({ q1: 'elimination', q2: null, q3: null }))
      .toEqual({ winType: 'elimination', rolesEnabled: false, isComplete: true })
  })

  it('returns incomplete when q1=declaration and q2 is null', () => {
    expect(resolveWinType({ q1: 'declaration', q2: null, q3: null }))
      .toEqual({ winType: null, rolesEnabled: false, isComplete: false })
  })

  it('resolves team from declaration + q2=team', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'team', q3: null }))
      .toEqual({ winType: 'team', rolesEnabled: false, isComplete: true })
  })

  it('resolves cooperative from declaration + q2=cooperative', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'cooperative', q3: null }))
      .toEqual({ winType: 'cooperative', rolesEnabled: false, isComplete: true })
  })

  it('returns incomplete when declaration + individual + q3=null', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'individual', q3: null }))
      .toEqual({ winType: null, rolesEnabled: false, isComplete: false })
  })

  it('resolves winner (no roles) from q3=no', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'individual', q3: 'no' }))
      .toEqual({ winType: 'winner', rolesEnabled: false, isComplete: true })
  })

  it('resolves winner with rolesEnabled from q3=roles', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'individual', q3: 'roles' }))
      .toEqual({ winType: 'winner', rolesEnabled: true, isComplete: true })
  })

  it('resolves secret-mission from q3=missions', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'individual', q3: 'missions' }))
      .toEqual({ winType: 'secret-mission', rolesEnabled: false, isComplete: true })
  })
})
