import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long!!'
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
