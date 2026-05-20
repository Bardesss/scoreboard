'use client'

import { SessionProvider } from 'next-auth/react'
import { TwoFactorSection } from './sections/TwoFactorSection'
import { LanguageSection } from './sections/LanguageSection'
import { PasswordSection } from './sections/PasswordSection'
import { LogoutSection } from './sections/LogoutSection'
import { AccountSection } from './sections/AccountSection'
import { EmailPreferencesSection } from './sections/EmailPreferencesSection'
import { PrivacySection } from './sections/PrivacySection'
import { UsernameSection } from './sections/UsernameSection'
import { DisplayNameSection } from './sections/DisplayNameSection'
import type { EmailPreferences } from '@/lib/emailPreferences'

export function SettingsClient({
  email,
  username,
  displayName,
  createdAt,
  locale,
  totpEnabled,
  requiresMfa,
  backupCodesRemaining,
  emailPreferences,
  publicProfileMode,
  allowAppearInOthers,
}: {
  email: string
  username: string | null
  displayName: string | null
  createdAt: string
  locale: string
  totpEnabled: boolean
  requiresMfa: boolean
  backupCodesRemaining: number
  emailPreferences: EmailPreferences
  publicProfileMode: 'private' | 'stats' | 'full'
  allowAppearInOthers: boolean
}) {
  return (
    <SessionProvider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <DisplayNameSection initial={displayName} />
        <UsernameSection initial={username} />
        <PrivacySection initial={{ publicProfileMode, allowAppearInOthers }} />
        <TwoFactorSection
          totpEnabled={totpEnabled}
          requiresMfa={requiresMfa}
          backupCodesRemaining={backupCodesRemaining}
        />
        <LanguageSection currentLocale={locale} />
        <PasswordSection />
        <EmailPreferencesSection initial={emailPreferences} />
        <LogoutSection />
        <AccountSection email={email} createdAt={createdAt} locale={locale === 'nl' ? 'nl' : 'en'} />
      </div>
    </SessionProvider>
  )
}
