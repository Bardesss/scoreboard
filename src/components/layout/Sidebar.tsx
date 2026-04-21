'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Dices, ClipboardList, CreditCard, Settings, UserPlus, User } from 'lucide-react'
import { NotificationBell } from './NotificationBell'

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
  { key: 'connections',  href: '/app/connections',  icon: UserPlus },
  { key: 'profile',      href: '/app/profile',      icon: User },
  { key: 'credits',      href: '/app/credits',      icon: CreditCard },
  { key: 'settings',     href: '/app/settings',     icon: Settings },
] as const

export default function Sidebar({ name, credits, unreadCount, notifications }: { name: string; email?: string; credits: number; unreadCount: number; notifications: NotificationItem[] }) {
  const pathname = usePathname()
  const t = useTranslations('app.nav')
  const tCredits = useTranslations('app.credits')

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
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.18)' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f5a623' }} />
          <span className="font-headline font-bold text-[12px]" style={{ color: '#f5a623' }}>{tCredits('balance', { n: credits })}</span>
        </div>
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

      {/* User footer */}
      <div className="p-4">
        <div className="flex items-center gap-2.5 p-3 rounded-[14px]" style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.08)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f5a623' }}>
            <span className="font-headline font-black text-[11px] tracking-[.02em]" style={{ color: '#1c1408' }}>
              {name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-body font-bold text-[12.5px] truncate" style={{ color: '#f7f3ed' }}>{name}</div>
            <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em]" style={{ color: '#4a3f2f' }}>{t('vaultKeeper')}</div>
          </div>
          <NotificationBell initialCount={unreadCount} initialNotifications={notifications} />
        </div>
      </div>
    </aside>
  )
}
