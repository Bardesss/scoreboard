import type { Metadata, Viewport } from 'next'
import { getLocale } from 'next-intl/server'
import { Toaster } from '@/components/ui/sonner'
import { SuppressAutofillOverlayErrors } from '@/components/SuppressAutofillOverlayErrors'
import { siteUrl, siteName } from '@/lib/seo'
import './globals.css'

export const metadata: Metadata = {
  // metadataBase makes every relative OG/canonical/sitemap URL resolve to an
  // absolute one. Locale layouts/pages override title, description, openGraph
  // and alternates with locale-specific values.
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: 'Log every game night, track stats, and settle debates once and for all.',
  applicationName: siteName,
  keywords: [
    'game night tracker',
    'board game scoreboard',
    'board game stats',
    'spelletjesavond',
    'scorebord',
    'dice vault',
  ],
  openGraph: {
    type: 'website',
    siteName,
    title: siteName,
    description: 'Log every game night, track stats, and settle debates once and for all.',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

// viewport-fit=cover lets `env(safe-area-inset-*)` resolve to real values, so the
// fixed bottom nav can pad itself against the device safe area / gesture bar.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The <html> element lives here (above the [locale] segment), so the locale
  // comes from next-intl's request context — resolved from the locale header
  // the i18n middleware sets. Non-localized routes (/app, /admin) fall back to
  // the default locale, which is correct since that UI is English.
  const locale = await getLocale()
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SuppressAutofillOverlayErrors />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
