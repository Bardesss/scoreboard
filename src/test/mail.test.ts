import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/integrations', () => ({
  getIntegrationConfig: vi.fn().mockResolvedValue({
    apiKey: 'test-key',
    domain: 'test.mailgun.org',
    from: 'Dice Vault <noreply@dicevault.fun>',
    region: 'eu',
  }),
}))

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

beforeEach(() => {
  process.env.NEXTAUTH_URL = 'https://dicevault.fun'
})

describe('mail', () => {
  it('sendVerificationEmail resolves without throwing', async () => {
    const { sendVerificationEmail } = await import('@/lib/mail')
    await expect(sendVerificationEmail('user@example.com', 'abc123', 'nl')).resolves.not.toThrow()
  })

  it('sendPasswordResetEmail resolves without throwing', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/mail')
    await expect(sendPasswordResetEmail('user@example.com', 'xyz789', 'en')).resolves.not.toThrow()
  })

  it('isMailConfigured returns true when config exists', async () => {
    const { isMailConfigured } = await import('@/lib/mail')
    expect(await isMailConfigured()).toBe(true)
  })

  it('isMailConfigured returns false when config is null', async () => {
    const { getIntegrationConfig } = await import('@/lib/integrations')
    vi.mocked(getIntegrationConfig).mockResolvedValueOnce(null)
    const { isMailConfigured } = await import('@/lib/mail')
    expect(await isMailConfigured()).toBe(false)
  })
})
