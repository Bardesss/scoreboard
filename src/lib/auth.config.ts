import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: '/en/auth/login',
  },
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
  session: { strategy: 'jwt' },
}
