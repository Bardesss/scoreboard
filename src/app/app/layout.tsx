import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import MobileHeader from '@/components/layout/MobileHeader'
import { LowCreditBanner } from '@/components/credits/LowCreditBanner'

async function loadMessages(locale: string) {
  const [common, authMsgs, app] = await Promise.all([
    import(`../../../messages/${locale}/common.json`).then(m => m.default),
    import(`../../../messages/${locale}/auth.json`).then(m => m.default),
    import(`../../../messages/${locale}/app.json`).then(m => m.default),
  ])
  return { common, auth: authMsgs, app }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  setRequestLocale(locale)

  const [user, linkedPlayer, threshold, unreadCount, recentNotifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, monthlyCredits: true, permanentCredits: true },
    }),
    prisma.player.findFirst({
      where: { linkedUserId: session.user.id },
      select: { name: true },
    }),
    prisma.adminSettings.findUnique({ where: { key: 'low_credit_threshold' } }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])
  if (!user) redirect('/en/auth/login')

  const totalCredits = user.monthlyCredits + user.permanentCredits
  const raw = threshold?.value
  const lowThreshold = typeof raw === 'number' ? raw : 20
  const isLow = totalCredits < lowThreshold

  const serializedNotifications = recentNotifications.map(n => ({
    id: n.id,
    type: n.type,
    meta: n.meta as Record<string, unknown> | null,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }))

  const messages = await loadMessages(locale)
  const tCredits = await getTranslations({ locale, namespace: 'app.credits' })

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {isLow && <LowCreditBanner message={tCredits('lowBanner')} buttonLabel={tCredits('buyCredits')} />}
      <Sidebar name={linkedPlayer?.name ?? user.email} email={user.email} credits={totalCredits} unreadCount={unreadCount} notifications={serializedNotifications} />
      <MobileHeader unreadCount={unreadCount} notifications={serializedNotifications} />
      <main
        className="lg:ml-64 min-h-screen relative z-10 pt-14 pb-20 lg:pt-0 lg:pb-0 px-6 lg:px-7"
        style={isLow ? { paddingTop: 'calc(3.5rem + 36px)' } : undefined}
      >
        {children}
      </main>
      <BottomNav />
    </NextIntlClientProvider>
  )
}
