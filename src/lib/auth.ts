import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        totpVerifiedToken: {},
      },
      async authorize(credentials) {
        // TOTP-verified flow: a pending token in Redis proves TOTP was passed
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

        // Normal email + password login
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
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.locale = (user as any).locale
        token.totpEnabled = (user as any).totpEnabled
        token.requiresMfa = (user as any).requiresMfa
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.locale = token.locale as string
      session.user.totpEnabled = token.totpEnabled as boolean
      session.user.requiresMfa = token.requiresMfa as boolean
      return session
    },
  },
  pages: {
    signIn: '/en/auth/login',
  },
  session: { strategy: 'jwt' },
})
