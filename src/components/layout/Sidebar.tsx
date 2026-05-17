'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Dices, ClipboardList, Plus } from 'lucide-react'
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

export default function Sidebar({ name, email, credits, unreadCount, notifications, isAdmin }: { name: string; email: string; credits: number; unreadCount: number; notifications: NotificationItem[]; isAdmin?: boolean }) {
  const pathname = usePathname()
  const t = useTranslations('app.nav')
  const tCredits = useTranslations('app.credits')
  const tLog = useTranslations('app.logGame')
  const logGame = useLogGame()

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

      {/* Credit chip */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.18)' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f5a623' }} />
          <span className="font-headline font-bold text-[12px]" style={{ color: '#f5a623' }}>{tCredits('balance', { n: credits })}</span>
        </div>
      </div>

      {/* Log game CTA */}
      <div className="px-4 mb-4">
        <button
          type="button"
          onClick={logGame.open}
          className="flex items-center justify-center gap-2 w-full font-headline font-bold text-[13px] tracking-[-0.005em] transition-all"
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: '#f5a623',
            color: '#1c1408',
            border: '1px solid rgba(245,166,35,0.6)',
            boxShadow: '0 4px 16px rgba(245,166,35,0.3)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ffb533' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f5a623' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          {tLog('trigger')}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
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
