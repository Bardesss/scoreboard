import NextAuth from 'next-auth'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { authConfig } from '@/lib/auth.config'

const handleI18n = createMiddleware(routing)
const { auth } = NextAuth(authConfig)

// Match against supported locales using only Accept-Language, ignoring any
// stale NEXT_LOCALE cookie. Used for entry points (e.g. QR scans) where the
// recipient is almost certainly a different person than whoever last set the
// cookie on this device.
function detectLocaleFromHeader(acceptLang: string | null): 'nl' | 'en' {
  if (!acceptLang) return routing.defaultLocale
  const tags = acceptLang.toLowerCase().split(',').map(s => s.split(';')[0].trim().slice(0, 2))
  for (const tag of tags) {
    if ((routing.locales as readonly string[]).includes(tag)) return tag as 'nl' | 'en'
  }
  return routing.defaultLocale
}

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return
  }

  if (pathname.startsWith('/share')) {
    return
  }

  // QR-scan entry: redirect to the scanner's browser language, not the device's
  // sticky NEXT_LOCALE cookie.
  if (/^\/connect\/[^/]+\/?$/.test(pathname)) {
    const locale = detectLocaleFromHeader(req.headers.get('accept-language'))
    return Response.redirect(new URL(`/${locale}${pathname.replace(/\/$/, '')}`, req.url))
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
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:jpg|jpeg|png|gif|webp|svg|ico|css|js)).*)'],
}
