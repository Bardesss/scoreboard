import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrismaUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  emailVerified: null as Date | null,
  locale: 'en',
  role: 'user',
  totpEnabled: false,
  totpSecret: null as string | null,
  totpBackupCodes: [] as string[],
  requiresMfa: false,
  monthlyCredits: 75,
  permanentCredits: 0,
  isLifetimeFree: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('@/lib/mail', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

// next/navigation redirect throws in server actions — mock it
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))

vi.mock('next-auth', () => ({ signIn: vi.fn() }))
vi.mock('@/lib/auth', () => ({ signIn: vi.fn() }))

describe('auth actions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('register', () => {
    it('returns error when email already in use', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPrismaUser)

      const { register } = await import('@/app/[locale]/auth/actions')
      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', 'password123')
      formData.set('passwordConfirm', 'password123')
      formData.set('locale', 'en')

      const result = await register(formData)
      expect(result).toEqual({ error: 'auth.errors.emailInUse' })
    })

    it('returns error when passwords do not match', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const { register } = await import('@/app/[locale]/auth/actions')
      const formData = new FormData()
      formData.set('email', 'new@example.com')
      formData.set('password', 'password123')
      formData.set('passwordConfirm', 'different')
      formData.set('locale', 'en')

      const result = await register(formData)
      expect(result).toEqual({ error: 'auth.errors.passwordMismatch' })
    })
  })

  describe('forgotPassword', () => {
    it('always returns success to prevent email enumeration', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const { forgotPassword } = await import('@/app/[locale]/auth/actions')
      const formData = new FormData()
      formData.set('email', 'nobody@example.com')
      formData.set('locale', 'en')

      const result = await forgotPassword(formData)
      expect(result).toEqual({ success: true })
    })
  })

  describe('resetPassword', () => {
    it('returns error when token not found in Redis', async () => {
      const { redis } = await import('@/lib/redis')
      vi.mocked(redis.get).mockResolvedValue(null)

      const { resetPassword } = await import('@/app/[locale]/auth/actions')
      const formData = new FormData()
      formData.set('token', 'invalid-token')
      formData.set('password', 'newpassword123')
      formData.set('passwordConfirm', 'newpassword123')

      const result = await resetPassword(formData)
      expect(result).toEqual({ error: 'auth.reset.invalid' })
    })
  })
})
