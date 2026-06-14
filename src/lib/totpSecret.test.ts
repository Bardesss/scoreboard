import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/encryption', () => ({
  encrypt: (s: string) => `aa:bb:${Buffer.from(s).toString('hex')}`,
  decrypt: (c: string) => Buffer.from(c.split(':')[2], 'hex').toString('utf8'),
}))
import { encryptTotpSecret, decryptTotpSecret } from './totpSecret'

beforeEach(() => vi.clearAllMocks())

it('round-trips an encrypted secret', () => {
  expect(decryptTotpSecret(encryptTotpSecret('JBSWY3DP'))).toBe('JBSWY3DP')
})
it('reads a legacy plaintext secret unchanged (backward compat)', () => {
  expect(decryptTotpSecret('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP')
})
