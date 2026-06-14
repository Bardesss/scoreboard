import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/lib/auth.config'
import { authorizeCredentials } from '@/lib/authorize'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, totpVerifiedToken: {} },
      authorize: (credentials) => authorizeCredentials(credentials),
    }),
  ],
})
