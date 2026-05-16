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
}

export default withNextIntl(nextConfig)
