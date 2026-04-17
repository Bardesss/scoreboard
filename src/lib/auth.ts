import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authConfig } from '@/lib/auth.config'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        totpVerifiedToken: {},
      },
      async authorize(credentials) {
        if (credentials.totpVerifiedToken) {
          const userId = await redis.get(`totp_verified:${credentials.totpVerifiedToken}`)
          if (!userId) return null
          await redis.del(`totp_verified:${credentials.totpVerifiedToken}`)
          const user = await prisma.user.findUnique({ where: { id: userId as string } })
          if (!user) return null
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            locale: user.locale,
            totpEnabled: user.totpEnabled,
            requiresMfa: user.requiresMfa,
          }
        }

        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
        if (!user || !user.emailVerified) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          locale: user.locale,
          totpEnabled: user.totpEnabled,
          requiresMfa: user.requiresMfa,
        }
      },
    }),
  ],
})
