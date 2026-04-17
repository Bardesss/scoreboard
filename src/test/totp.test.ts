import { describe, it, expect } from 'vitest'
import { generateTOTPSecret, verifyTOTPCode, generateBackupCodes } from '@/lib/totp'

describe('totp', () => {
  it('generateTOTPSecret returns a base32 secret and otpauth URI', () => {
    const result = generateTOTPSecret('test@example.com')
    expect(result.secret).toBeTruthy()
    expect(result.uri).toContain('otpauth://totp/')
    expect(result.uri).toContain('test%40example.com')
  })

  it('verifyTOTPCode returns false for an invalid code', () => {
    const { secret } = generateTOTPSecret('test@example.com')
    expect(verifyTOTPCode(secret, '000000')).toBe(false)
  })

  it('generateBackupCodes returns 8 unique 10-char codes', () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(8)
    const unique = new Set(codes)
    expect(unique.size).toBe(8)
    codes.forEach(c => expect(c).toHaveLength(10))
  })
})
