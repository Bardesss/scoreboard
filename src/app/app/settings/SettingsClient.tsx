'use client'

import { SessionProvider } from 'next-auth/react'
import { TwoFactorSection } from './sections/TwoFactorSection'
import { LanguageSection } from './sections/LanguageSection'
import { PasswordSection } from './sections/PasswordSection'
import { LogoutSection } from './sections/LogoutSection'
import { AccountSection } from './sections/AccountSection'

export function SettingsClient({
  email,
  createdAt,
  locale,
  totpEnabled,
  requiresMfa,
  backupCodesRemaining,
}: {
  email: string
  createdAt: string
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
        <AccountSection email={email} createdAt={createdAt} locale={locale === 'nl' ? 'nl' : 'en'} />
      </div>
    </SessionProvider>
  )
}
