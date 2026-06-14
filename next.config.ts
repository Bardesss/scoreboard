import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig = {
  output: 'standalone' as const,
  // TypeScript and ESLint run pre-commit / locally, not during `next build`.
  // The type-check phase is single-process and peaks at 2-3 GB on this
  // codebase, which OOMs the Coolify VPS (kernel SIGKILLs the process — log
  // truncates silently at "Linting and checking validity of types ..."). With
  // these off, build peak stays under the 1536 MB heap cap and deploys
  // through cleanly. Run `npx tsc --noEmit` before pushing.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Lowers peak webpack heap by avoiding redundant module duplication during
    // compilation. The codebase has grown past what fits in the 1536 MB cap on
    // Coolify (kernel SIGKILLs at "Creating an optimized production build...");
    // this flag is Next's official lever for memory-constrained builds.
    webpackMemoryOptimizations: true,
    // Static-page generation defaults spawn multiple worker processes, each of
    // which loads the full app bundle. On the Coolify VPS this blows past
    // available RAM and the kernel SIGKILLs mid-static-gen (log dies at
    // "Generating static pages (X/37) ..."). Forcing min-pages-per-worker
    // above the total page count keeps generation in a single worker; pinning
    // max-concurrency low keeps that worker's in-flight render set small.
    staticGenerationMinPagesPerWorker: 200,
    staticGenerationMaxConcurrency: 2,
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.bartusoost.nl",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "media-src 'self'",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://analytics.bartusoost.nl",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
