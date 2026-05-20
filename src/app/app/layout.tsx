import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import MobileHeader from '@/components/layout/MobileHeader'
import { LowCreditBanner } from '@/components/credits/LowCreditBanner'
import { FreeModeBanner } from '@/components/credits/FreeModeBanner'
import { loadFreeModeState } from '@/lib/freeMode'
import { LogGameProvider, type LeagueOption } from '@/components/layout/LogGameLauncher'

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

  const [user, linkedPlayer, threshold, unreadCount, recentNotifications, accessibleLeagues, freeMode] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, monthlyCredits: true, permanentCredits: true, isLifetimeFree: true, role: true, avatarColor: true, avatarIcon: true },
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
    prisma.league.findMany({
      where: {
        OR: [
          { ownerId: session.user.id },
          { members: { some: { player: { userId: session.user.id } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        gameTemplate: { select: { icon: true, color: true } },
        playedGames: {
          orderBy: { playedAt: 'desc' },
          take: 1,
          select: { playedAt: true },
        },
      },
    }),
    loadFreeModeState(),
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

  const bannerText = locale === 'nl' ? freeMode.bannerNl : freeMode.bannerEn
  const tFreeMode = await getTranslations({ locale, namespace: 'app.freeMode' })
  const freeModeText = bannerText.trim().length > 0 ? bannerText : tFreeMode('defaultBannerText')
  const dismissAria = tFreeMode('dismissAria')
  const showFreeBanner = freeMode.active
  const showLowBanner = !showFreeBanner && isLow
  const showAnyBanner = showFreeBanner || showLowBanner

  const leagueOptions: LeagueOption[] = accessibleLeagues.map(l => ({
    id: l.id,
    name: l.name,
    gameTemplate: { icon: l.gameTemplate.icon, color: l.gameTemplate.color },
    lastPlayedAt: l.playedGames[0]?.playedAt.toISOString() ?? null,
  }))

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {showFreeBanner && <FreeModeBanner text={freeModeText} dismissAriaLabel={dismissAria} />}
      {showLowBanner && <LowCreditBanner message={tCredits('lowBanner')} buttonLabel={tCredits('buyCredits')} />}
      <LogGameProvider leagues={leagueOptions}>
        <Sidebar name={linkedPlayer?.name ?? user.email} email={user.email} credits={totalCredits} monthlyCredits={user.monthlyCredits} permanentCredits={user.permanentCredits} isLifetimeFree={user.isLifetimeFree} unreadCount={unreadCount} notifications={serializedNotifications} isAdmin={user.role === 'admin'} avatarColor={user.avatarColor} avatarIcon={user.avatarIcon} />
        <MobileHeader name={linkedPlayer?.name ?? user.email} email={user.email} credits={totalCredits} isAdmin={user.role === 'admin'} unreadCount={unreadCount} notifications={serializedNotifications} avatarColor={user.avatarColor} avatarIcon={user.avatarIcon} />
        <main
          className={`lg:ml-64 min-h-screen relative z-10 pb-20 lg:pb-0 px-4 lg:px-7 ${showAnyBanner ? 'pt-[92px] lg:pt-9' : 'pt-14 lg:pt-0'}`}
        >
          {children}
        </main>
        <BottomNav />
      </LogGameProvider>
    </NextIntlClientProvider>
  )
}
