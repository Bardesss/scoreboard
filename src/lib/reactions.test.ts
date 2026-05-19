import { describe, it, expect } from 'vitest'
import { ALLOWED_REACTIONS, isAllowedReaction } from '@/lib/reactions'

describe('ALLOWED_REACTIONS', () => {
  it('is exactly the five emoji from the spec', () => {
    expect(ALLOWED_REACTIONS).toEqual(['🔥', '👏', '🎲', '😅', '💪'])
  })
})

describe('isAllowedReaction', () => {
  it('returns true for any allowed emoji', () => {
    for (const e of ALLOWED_REACTIONS) expect(isAllowedReaction(e)).toBe(true)
  })
  it('returns false for an unrelated emoji', () => {
    expect(isAllowedReaction('🍕')).toBe(false)
  })
  it('returns false for a non-string', () => {
    expect(isAllowedReaction(42 as never)).toBe(false)
  })
})
