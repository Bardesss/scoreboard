import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

// AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) are
// intentionally allowed via the wildcard rule — Dice Vault opts in to GEO
// visibility in generative answer engines. Only authenticated/transactional
// areas are disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/app',
          '/admin',
          '/api',
          '/share',
          '/connect',
          '/en/auth',
          '/nl/auth',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
