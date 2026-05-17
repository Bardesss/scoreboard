'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Dices, ClipboardList, Plus, ChevronRight, CalendarDays, Infinity as InfinityIcon } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'
import { useLogGame } from './LogGameLauncher'

type NotificationItem = {
  id: string
  type: string
  meta: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

const NAV = [
  { key: 'dashboard',    href: '/app/dashboard',    icon: LayoutDashboard },
  { key: 'players',      href: '/app/players',      icon: Users },
  { key: 'games',        href: '/app/games',        icon: Dices },
  { key: 'leagues',      href: '/app/leagues',      icon: ClipboardList },
] as const

export default function Sidebar({ name, email, credits, monthlyCredits, permanentCredits, isLifetimeFree, unreadCount, notifications, isAdmin }: { name: string; email: string; credits: number; monthlyCredits: number; permanentCredits: number; isLifetimeFree: boolean; unreadCount: number; notifications: NotificationItem[]; isAdmin?: boolean }) {
  const pathname = usePathname()
  const t = useTranslations('app.nav')
  const tCredits = useTranslations('app.credits')
  const tLog = useTranslations('app.logGame')
  const logGame = useLogGame()

  const monthlyPct = !isLifetimeFree && credits > 0 ? (monthlyCredits / credits) * 100 : 0
  const permanentPct = !isLifetimeFree && credits > 0 ? (permanentCredits / credits) * 100 : 0

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col z-40" style={{ background: '#1c1810', borderRight: '1px solid rgba(245,166,35,0.08)' }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: '#f5a623', boxShadow: '0 4px 16px rgba(245,166,35,0.3)' }}>
            <Dices size={18} strokeWidth={2.2} style={{ color: '#1c1408' }} />
          </div>
          <div>
            <div className="font-headline font-black text-[14.5px] tracking-[-0.02em] leading-none" style={{ color: '#f7f3ed' }}>Dice Vault</div>
            <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] leading-none mt-0.5" style={{ color: '#4a3f2f' }}>dicevault.fun</div>
          </div>
        </Link>
      </div>

      {/* Credits vault — recessed, links to /app/credits */}
      <div className="px-4 mb-4">
        <Link href="/app/credits" className="block group">
          <div
            className="px-3 py-2.5 rounded-xl transition-colors"
            style={{
              background: '#100c06',
              boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.4), inset 0 -1px 0 rgba(245,166,35,0.04)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#15110a' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#100c06' }}
          >
            <div className="flex items-center justify-between gap-2" style={{ marginBottom: isLifetimeFree ? 0 : 8 }}>
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-headline font-black text-[15px] leading-none" style={{ color: '#f5a623' }}>
                  {isLifetimeFree ? '∞' : credits}
                </span>
                <span className="font-headline font-bold text-[9px] uppercase leading-none" style={{ color: '#7a6a52', letterSpacing: '0.12em' }}>
                  {isLifetimeFree ? tCredits('lifetimeFree') : tCredits('balanceCredits')}
                </span>
              </div>
              <ChevronRight
                size={13}
                className="group-hover:translate-x-0.5"
                style={{ color: '#7a6a52', flexShrink: 0, transition: 'transform 160ms ease' }}
              />
            </div>

            {!isLifetimeFree && (
              <>
                <div
                  style={{
                    height: 2,
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    display: 'flex',
                    marginBottom: 7,
                  }}
                >
                  {credits > 0 && (
                    <>
                      <div style={{ width: `${monthlyPct}%`, background: '#f5a623', transition: 'width 240ms ease' }} />
                      <div style={{ width: `${permanentPct}%`, background: '#c27f0a', transition: 'width 240ms ease' }} />
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between" style={{ fontSize: 10 }}>
                  <div className="flex items-center gap-1 font-headline font-bold" style={{ color: '#f5a623' }}>
                    <CalendarDays size={10} strokeWidth={2.5} />
                    {monthlyCredits}
                  </div>
                  <div className="flex items-center gap-1 font-headline font-bold" style={{ color: '#c27f0a' }}>
                    <InfinityIcon size={11} strokeWidth={2.2} />
                    {permanentCredits}
                  </div>
                </div>
              </>
            )}
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        <button
          type="button"
          onClick={logGame.open}
          className="flex items-center gap-[11px] w-full px-[14px] py-[10px] rounded-xl font-headline font-semibold text-[13.5px] transition-all"
          style={{
            background: 'rgba(245,166,35,0.12)',
            color: '#f5a623',
            boxShadow: 'inset 0 0 0 1px rgba(245,166,35,0.22)',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.18)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.12)' }}
        >
          <Plus size={17} strokeWidth={2.4} className="flex-shrink-0" />
          {tLog('trigger')}
        </button>

        <div aria-hidden style={{ height: 1, margin: '8px 6px', background: 'rgba(245,166,35,0.08)' }} />

        {NAV.map(({ key, href, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={key}
              href={href}
              className="flex items-center gap-[11px] px-[14px] py-[10px] rounded-xl font-headline font-semibold text-[13.5px] transition-all"
              style={active
                ? { background: 'rgba(245,166,35,0.12)', color: '#f5a623', boxShadow: 'inset 0 0 0 1px rgba(245,166,35,0.2)' }
                : { color: '#9a8878' }
              }
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.06)'; (e.currentTarget as HTMLElement).style.color = '#f7f3ed' }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = '#9a8878' } }}
            >
              <Icon size={17} className="flex-shrink-0" />
              {t(key)}
            </Link>
          )
        })}
      </nav>

      {/* User footer: avatar/name dropdown + notification bell */}
      <div className="p-4 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <UserMenu name={name} email={email} credits={credits} isAdmin={isAdmin} variant="sidebar" />
        </div>
        <NotificationBell initialCount={unreadCount} initialNotifications={notifications} position="up-right" />
      </div>
    </aside>
  )
}
