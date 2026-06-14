import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long!!'
})

afterEach(() => { vi.unstubAllEnvs() })

describe('encryption key guard', () => {
  it('throws when NEXTAUTH_SECRET is missing or weak', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'short')
    vi.resetModules()
    const mod = await import('./encryption')
    expect(() => mod.encrypt('x')).toThrow(/NEXTAUTH_SECRET/)
  })

  it('round-trips when the secret is strong', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'a'.repeat(32))
    vi.resetModules()
    const mod = await import('./encryption')
    expect(mod.decrypt(mod.encrypt('hello'))).toBe('hello')
  })
})

describe('encrypt / decrypt', () => {
  it('round-trips a string', async () => {
    const { encrypt, decrypt } = await import('./encryption')
    const plaintext = 'hello world'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const { encrypt } = await import('./encryption')
    expect(encrypt('same input')).not.toBe(encrypt('same input'))
  })

  it('round-trips a JSON object serialized to string', async () => {
    const { encrypt, decrypt } = await import('./encryption')
    const obj = JSON.stringify({ apiKey: 'key123', domain: 'mg.example.com' })
    expect(decrypt(encrypt(obj))).toBe(obj)
  })

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('./encryption')
    const ciphertext = encrypt('secret')
    const tampered = ciphertext.slice(0, -4) + 'xxxx'
    expect(() => decrypt(tampered)).toThrow()
  })
})
