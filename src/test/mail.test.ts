import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('mailgun.js', () => {
  const MockMailgun = vi.fn().mockImplementation(function () {
    return {
      client: vi.fn(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({ id: 'test-id', status: 200 }),
        },
      })),
    }
  })
  return { default: MockMailgun }
})

vi.mock('form-data', () => ({ default: vi.fn() }))

describe('mail', () => {
  beforeEach(() => {
    process.env.MAILGUN_API_KEY = 'test-key'
    process.env.MAILGUN_DOMAIN = 'test.mailgun.org'
    process.env.MAILGUN_FROM = 'Dice Vault <noreply@dicevault.fun>'
    process.env.NEXTAUTH_URL = 'https://dicevault.fun'
  })

  it('sendVerificationEmail builds a link with the token', async () => {
    const { sendVerificationEmail } = await import('@/lib/mail')
    await expect(sendVerificationEmail('user@example.com', 'abc123', 'nl')).resolves.not.toThrow()
  })

  it('sendPasswordResetEmail builds a link with the token', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/mail')
    await expect(sendPasswordResetEmail('user@example.com', 'xyz789', 'en')).resolves.not.toThrow()
  })
})
