'use client'

import { SessionProvider } from 'next-auth/react'
import { TwoFactorSection } from './sections/TwoFactorSection'
import { LanguageSection } from './sections/LanguageSection'
import { PasswordSection } from './sections/PasswordSection'
import { LogoutSection } from './sections/LogoutSection'

export function SettingsClient({
  locale,
  totpEnabled,
  requiresMfa,
  backupCodesRemaining,
}: {
  locale: string
  totpEnabled: boolean
  requiresMfa: boolean
  backupCodesRemaining: number
}) {
  return (
    <SessionProvider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TwoFactorSection
          totpEnabled={totpEnabled}
          requiresMfa={requiresMfa}
          backupCodesRemaining={backupCodesRemaining}
        />
        <LanguageSection currentLocale={locale} />
        <PasswordSection />
        <LogoutSection />
      </div>
    </SessionProvider>
  )
}
