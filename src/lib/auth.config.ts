import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: '/en/auth/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as typeof user & { role: string; locale: string; totpEnabled: boolean; requiresMfa: boolean }
        token.id = u.id
        token.role = u.role
        token.locale = u.locale
        token.totpEnabled = u.totpEnabled
        token.requiresMfa = u.requiresMfa
      }
      if (trigger === 'update' && session && typeof session === 'object') {
        const s = session as { locale?: unknown; totpEnabled?: unknown }
        if (typeof s.locale === 'string') token.locale = s.locale
        if (typeof s.totpEnabled === 'boolean') token.totpEnabled = s.totpEnabled
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
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,   // 30 days
    updateAge: 24 * 60 * 60,      // refresh the token once per day
  },
}
