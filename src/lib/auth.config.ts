import type { NextAuthConfig } from 'next-auth'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days
const useSecureCookies = process.env.NODE_ENV === 'production'

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
    maxAge: SESSION_MAX_AGE,
    updateAge: 24 * 60 * 60,      // refresh the token once per day
  },
  // Auth.js's defaultCookies for sessionToken only set `Expires`, not `Max-Age`
  // — modern mobile browsers (Safari iOS especially) treat cookies without
  // Max-Age as session-scoped and discard them on tab close. Explicitly setting
  // maxAge here serializes both attributes so the cookie reliably persists for
  // the full 30 days on every platform. Name matches the Auth.js default so
  // existing logged-in users aren't kicked.
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? '__Secure-' : ''}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: SESSION_MAX_AGE,
      },
    },
  },
}
