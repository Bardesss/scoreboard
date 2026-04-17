import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import MobileHeader from '@/components/layout/MobileHeader'

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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, monthlyCredits: true, permanentCredits: true },
  })
  if (!user) redirect('/en/auth/login')

  const totalCredits = user.monthlyCredits + user.permanentCredits
  const messages = await loadMessages(locale)

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Sidebar email={user.email} credits={totalCredits} />
      <MobileHeader />
      <main className="lg:ml-64 min-h-screen relative z-10 pt-14 pb-20 lg:pt-0 lg:pb-0 px-6 lg:px-7">
        {children}
      </main>
      <BottomNav />
    </NextIntlClientProvider>
  )
}
