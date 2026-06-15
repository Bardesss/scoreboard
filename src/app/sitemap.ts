import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { siteUrl } from '@/lib/seo'
import { routing } from '@/i18n/routing'

// Emits the landing page and every published custom page, once per locale, each
// carrying the full hreflang alternates map so search engines treat the locale
// variants as translations of one another.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await prisma.page.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
  })

  const routes: { path: string; lastModified: Date; changeFrequency: 'weekly' | 'monthly' }[] = [
    { path: '', lastModified: new Date(), changeFrequency: 'weekly' },
    ...pages.map(p => ({
      path: `/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const,
    })),
  ]

  const entries: MetadataRoute.Sitemap = []
  for (const route of routes) {
    const languages: Record<string, string> = {}
    for (const l of routing.locales) languages[l] = `${siteUrl}/${l}${route.path}`

    for (const locale of routing.locales) {
      entries.push({
        url: `${siteUrl}/${locale}${route.path}`,
        lastModified: route.lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.path === '' ? 1 : 0.7,
        alternates: { languages },
      })
    }
  }

  return entries
}
