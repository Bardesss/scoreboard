import { describe, it, expect } from 'vitest'
import { resolveDisplayName } from './displayName'

describe('resolveDisplayName', () => {
  it('prefers displayName when present', () => {
    expect(resolveDisplayName({ displayName: 'Bartus V.', username: 'bartus', email: 'b@x.com' }))
      .toBe('Bartus V.')
  })

  it('falls back to username when displayName is absent', () => {
    expect(resolveDisplayName({ displayName: null, username: 'bartus', email: 'b@x.com' }))
      .toBe('bartus')
  })

  it('falls back to the email local-part when displayName and username are absent', () => {
    expect(resolveDisplayName({ displayName: null, username: null, email: 'bartus@example.com' }))
      .toBe('bartus')
  })

  it('treats an empty-string displayName as absent', () => {
    expect(resolveDisplayName({ displayName: '', username: 'bartus', email: 'b@x.com' }))
      .toBe('bartus')
  })

  it('returns an empty string when nothing is available', () => {
    expect(resolveDisplayName({})).toBe('')
  })
})
