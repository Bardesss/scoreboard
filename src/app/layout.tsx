import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { SuppressAutofillOverlayErrors } from '@/components/SuppressAutofillOverlayErrors'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Dice Vault',
    template: '%s | Dice Vault',
  },
  description: 'Log every game night, track stats, and settle debates once and for all.',
}

// viewport-fit=cover lets `env(safe-area-inset-*)` resolve to real values, so the
// fixed bottom nav can pad itself against the device safe area / gesture bar.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
