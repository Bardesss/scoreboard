import { auth } from '@/lib/auth'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const handleI18n = createMiddleware(routing)

export default auth(function middleware(req: NextRequest & { auth: any }) {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/app') || pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/en/auth/login', req.url))
    }
    if (pathname.startsWith('/admin') && session.user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/en', req.url))
    }
    return NextResponse.next()
  }

  return handleI18n(req)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
