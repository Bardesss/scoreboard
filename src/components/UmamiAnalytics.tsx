import Script from 'next/script'

/**
 * Self-hosted Umami analytics, included on public (unauthenticated) pages only.
 * The analytics origin is also allowlisted in the CSP (script-src + connect-src)
 * in next.config.ts — keep the two in sync.
 */
export function UmamiAnalytics() {
  return (
    <Script
      defer
      src="https://analytics.bartusoost.nl/script.js"
      data-website-id="f71f7b9b-7beb-4d05-ad64-52f1c928de12"
    />
  )
}
