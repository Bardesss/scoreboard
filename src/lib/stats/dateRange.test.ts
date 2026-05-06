import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { parseRange, rangeToWhere, cacheSuffix } from './dateRange'

describe('parseRange', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-23T12:00:00Z')) })
  afterAll(() => { vi.useRealTimers() })

  it('defaults to all when range missing', () => {
    expect(parseRange({})).toEqual({ range: 'all', from: null, to: null })
  })

  it('parses week → ISO week start', () => {
    const f = parseRange({ range: 'week' })
    expect(f.range).toBe('week')
    expect(f.from?.getUTCDay()).toBe(1) // Monday
    expect(f.to).toBeNull()
  })

  it('parses month → first of current month UTC', () => {
    const f = parseRange({ range: 'month' })
    expect(f.range).toBe('month')
    expect(f.from?.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('parses year → Jan 1 UTC', () => {
    const f = parseRange({ range: 'year' })
    expect(f.from?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('parses custom with from+to', () => {
    const f = parseRange({ range: 'custom', from: '2026-01-15', to: '2026-03-01' })
    expect(f.range).toBe('custom')
    expect(f.from?.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(f.to?.toISOString()).toBe('2026-03-01T23:59:59.999Z')
  })

  it('falls back to all on malformed custom', () => {
    expect(parseRange({ range: 'custom', from: 'invalid' })).toEqual({ range: 'all', from: null, to: null })
    expect(parseRange({ range: 'custom' })).toEqual({ range: 'all', from: null, to: null })
  })
})

describe('rangeToWhere', () => {
  it('returns empty for all', () => {
    expect(rangeToWhere({ range: 'all', from: null, to: null })).toEqual({})
  })

  it('returns gte only for week', () => {
    const from = new Date('2026-04-20T00:00:00Z')
    expect(rangeToWhere({ range: 'week', from, to: null })).toEqual({ playedAt: { gte: from } })
  })

  it('returns gte+lte for custom', () => {
    const from = new Date('2026-01-15')
    const to = new Date('2026-03-01')
    expect(rangeToWhere({ range: 'custom', from, to })).toEqual({ playedAt: { gte: from, lte: to } })
  })
})

describe('cacheSuffix', () => {
  it('returns range key for non-custom', () => {
    expect(cacheSuffix({ range: 'week', from: new Date(), to: null })).toBe('week')
    expect(cacheSuffix({ range: 'all', from: null, to: null })).toBe('all')
  })

  it('returns null for custom (cache skip)', () => {
    expect(cacheSuffix({ range: 'custom', from: new Date(), to: new Date() })).toBeNull()
  })
})
