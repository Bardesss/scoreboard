import { describe, it, expect } from 'vitest'
import { canViewPublicProfile, shouldRenderGames, anonymizeName } from '@/lib/social/privacy'

describe('canViewPublicProfile', () => {
  it('rejects private mode', () => {
    expect(canViewPublicProfile({ publicProfileMode: 'private' })).toBe(false)
  })
  it('accepts stats mode', () => {
    expect(canViewPublicProfile({ publicProfileMode: 'stats' })).toBe(true)
  })
  it('accepts full mode', () => {
    expect(canViewPublicProfile({ publicProfileMode: 'full' })).toBe(true)
  })
  it('rejects unknown modes (defensive)', () => {
    expect(canViewPublicProfile({ publicProfileMode: 'whatever' })).toBe(false)
  })
})

describe('shouldRenderGames', () => {
  it('returns true only for full mode', () => {
    expect(shouldRenderGames({ publicProfileMode: 'full' })).toBe(true)
    expect(shouldRenderGames({ publicProfileMode: 'stats' })).toBe(false)
    expect(shouldRenderGames({ publicProfileMode: 'private' })).toBe(false)
  })
})

describe('anonymizeName', () => {
  it('returns real name when subject opted in', () => {
    expect(anonymizeName('public', { allowAppearInOthers: true, name: 'Anna' }, 0)).toBe('Anna')
  })
  it('returns "Speler {letter}" when subject opted out', () => {
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'Anna' }, 0)).toBe('Speler A')
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'Anna' }, 1)).toBe('Speler B')
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'Anna' }, 25)).toBe('Speler Z')
  })
  it('wraps past Z with AA, AB... (defensive for huge lobbies)', () => {
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'X' }, 26)).toBe('Speler AA')
    expect(anonymizeName('public', { allowAppearInOthers: false, name: 'X' }, 27)).toBe('Speler AB')
  })
})
