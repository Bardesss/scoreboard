import { describe, it, expect } from 'vitest'
import { formatTime, parseTimeInput } from './formatTime'

describe('formatTime', () => {
  it('formats seconds as bare number + s', () => {
    expect(formatTime(45, 'seconds')).toBe('45s')
  })

  it('formats minutes as decimal minutes', () => {
    expect(formatTime(270, 'minutes')).toBe('4.5 min')
    expect(formatTime(60, 'minutes')).toBe('1.0 min')
  })

  it('formats mmss as M:SS', () => {
    expect(formatTime(270, 'mmss')).toBe('4:30')
    expect(formatTime(65, 'mmss')).toBe('1:05')
    expect(formatTime(3600, 'mmss')).toBe('60:00')
  })

  it('defaults to seconds when unit null', () => {
    expect(formatTime(42, null)).toBe('42s')
  })
})

describe('parseTimeInput', () => {
  it('parses seconds as integer', () => {
    expect(parseTimeInput('45', 'seconds')).toBe(45)
  })

  it('parses minutes decimal to seconds', () => {
    expect(parseTimeInput('4.5', 'minutes')).toBe(270)
    expect(parseTimeInput('1', 'minutes')).toBe(60)
  })

  it('parses mmss as mm:ss tuple', () => {
    expect(parseTimeInput({ mm: '4', ss: '30' }, 'mmss')).toBe(270)
    expect(parseTimeInput({ mm: '0', ss: '9' }, 'mmss')).toBe(9)
  })

  it('returns null for invalid inputs', () => {
    expect(parseTimeInput('', 'seconds')).toBeNull()
    expect(parseTimeInput('abc', 'minutes')).toBeNull()
    expect(parseTimeInput({ mm: '', ss: '' }, 'mmss')).toBeNull()
    expect(parseTimeInput({ mm: '0', ss: '60' }, 'mmss')).toBeNull() // seconds overflow
  })
})
