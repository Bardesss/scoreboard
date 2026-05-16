import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      locale: true,
      totpEnabled: true,
      requiresMfa: true,
      totpBackupCodes: true,
    },
  })
  if (!user) redirect('/en/auth/login')

  const t = await getTranslations({ locale: user.locale, namespace: 'app.settings' })

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <header className="mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('pageTitle')}</h1>
        <p className="font-body text-sm mt-1" style={{ color: '#9a8878' }}>{t('subtitle')}</p>
      </header>
      <SettingsClient
        locale={user.locale}
        totpEnabled={user.totpEnabled}
        requiresMfa={user.requiresMfa}
        backupCodesRemaining={user.totpBackupCodes.length}
      />
    </div>
  )
}
