import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SettingsClient } from './SettingsClient'
import { readPreferences } from '@/lib/emailPreferences'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      username: true,
      displayName: true,
      locale: true,
      totpEnabled: true,
      requiresMfa: true,
      totpBackupCodes: true,
      createdAt: true,
      emailPreferences: true,
      publicProfileMode: true,
      allowAppearInOthers: true,
    },
  })
  if (!user) redirect('/en/auth/login')

  const t = await getTranslations({ locale: user.locale, namespace: 'app.settings' })
  const initialPrefs = readPreferences(user.emailPreferences)

  return (
    <div className="max-w-2xl mx-auto py-8">
      <header className="mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1e1a14' }}>{t('pageTitle')}</h1>
        <p className="font-body text-sm mt-1" style={{ color: '#9a8878' }}>{t('subtitle')}</p>
      </header>
      <SettingsClient
        email={user.email}
        username={user.username}
        displayName={user.displayName}
        createdAt={user.createdAt.toISOString()}
        locale={user.locale}
        totpEnabled={user.totpEnabled}
        requiresMfa={user.requiresMfa}
        backupCodesRemaining={user.totpBackupCodes.length}
        emailPreferences={initialPrefs}
        publicProfileMode={user.publicProfileMode as 'private' | 'stats' | 'full'}
        allowAppearInOthers={user.allowAppearInOthers}
      />
    </div>
  )
}
