import { routing } from '@/i18n/routing'

// Single source of truth for the public origin used in metadata, OG tags,
// canonical/hreflang links, the sitemap and robots. NEXT_PUBLIC_APP_URL is the
// canonical public URL; NEXTAUTH_URL is the runtime fallback already used for
// absolute links elsewhere (see connectToken). Trailing slash stripped so we
// can append paths without doubling up.
export const siteUrl = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  'https://dicevault.fun'
).replace(/\/$/, '')

export const siteName = 'Dice Vault'

function normalizePath(path: string): string {
  if (!path) return ''
  return `/${path.replace(/^\/+/, '')}`
}

export function ogLocale(locale: string): string {
  return locale === 'nl' ? 'nl_NL' : 'en_US'
}

// canonical points at the current locale's own URL (each locale is canonical to
// itself); languages lists every locale + x-default so search engines learn the
// pages are translations of one another.
export function localizedAlternates(locale: string, path = '') {
  const p = normalizePath(path)
  const languages: Record<string, string> = {}
  for (const l of routing.locales) languages[l] = `${siteUrl}/${l}${p}`
  languages['x-default'] = `${siteUrl}/${routing.defaultLocale}${p}`
  return {
    canonical: `${siteUrl}/${locale}${p}`,
    languages,
  }
}

export function buildOpenGraph(opts: {
  locale: string
  title: string
  description: string
  path?: string
}) {
  return {
    type: 'website' as const,
    siteName,
    locale: ogLocale(opts.locale),
    alternateLocale: opts.locale === 'nl' ? 'en_US' : 'nl_NL',
    title: opts.title,
    description: opts.description,
    url: `${siteUrl}/${opts.locale}${normalizePath(opts.path ?? '')}`,
  }
}
