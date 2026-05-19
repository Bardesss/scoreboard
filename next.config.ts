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
}

export default withNextIntl(nextConfig)
