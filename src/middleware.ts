import NextAuth from 'next-auth'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { authConfig } from '@/lib/auth.config'

const handleI18n = createMiddleware(routing)
const { auth } = NextAuth(authConfig)

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return
  }

  if (pathname.startsWith('/app') || pathname.startsWith('/admin')) {
    if (!session) {
      return Response.redirect(new URL('/en/auth/login', req.url))
    }
    if (pathname.startsWith('/admin') && session.user?.role !== 'admin') {
      return Response.redirect(new URL('/en', req.url))
    }
    return
  }

  return handleI18n(req)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
