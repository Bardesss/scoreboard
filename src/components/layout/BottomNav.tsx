'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Dices, Trophy, Plus } from 'lucide-react'
import { useLogGame } from './LogGameLauncher'

const LEFT_NAV = [
  { key: 'dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { key: 'players',   href: '/app/players',   icon: Users },
] as const

const RIGHT_NAV = [
  { key: 'games',     href: '/app/games',     icon: Dices },
  { key: 'leagues',   href: '/app/leagues',   icon: Trophy },
] as const

export default function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('app.nav')
  const tLog = useTranslations('app.logGame')
  const logGame = useLogGame()

  return (
    <nav
      className="lg:hidden flex items-center justify-around px-2 py-2"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        // Pin the bar to a deterministic height so its box never depends on the
        // tallest child (the 56px FAB) or label wrapping per locale.
        boxSizing: 'border-box',
        // Fixed height (not minHeight): with border-box, a paddingBottom that grows
        // with the safe-area inset would otherwise push a minHeight box past 76px when
        // the inset appears mid-session (mobile toolbar settling on route change),
        // making the bar visibly expand. Baking the inset into an explicit height keeps
        // the content area a constant 56px (the FAB) regardless of inset or navigation.
        height: 'calc(76px + env(safe-area-inset-bottom))',
        // Clear the device safe area / gesture bar; stays 76px where the inset is 0.
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        background: 'rgba(247,243,237,0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(245,166,35,0.1)',
        // Promote to its own compositing layer so the backdrop-filter doesn't
        // repaint/jitter while Firefox-Android's bottom toolbar animates on scroll.
        transform: 'translateZ(0)',
      }}
    >
      {LEFT_NAV.map(({ key, href, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={key}
            href={href}
            className={`flex flex-col items-center gap-[3px] px-3.5 py-1.5 rounded-[10px] font-headline font-extrabold text-[9px] uppercase tracking-[.08em] transition-colors ${active ? 'text-primary' : 'text-outline'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
            {t(key)}
          </Link>
        )
      })}

      <button
        type="button"
        onClick={logGame.open}
        aria-label={tLog('trigger')}
        title={tLog('trigger')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 56,
          borderRadius: 999,
          background: '#f5a623',
          color: '#1c1408',
          border: 'none',
          cursor: 'pointer',
          transform: 'translateY(-14px)',
          boxShadow: '0 8px 24px rgba(245,166,35,0.4), 0 2px 4px rgba(60,40,15,0.15)',
        }}
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      {RIGHT_NAV.map(({ key, href, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={key}
            href={href}
            className={`flex flex-col items-center gap-[3px] px-3.5 py-1.5 rounded-[10px] font-headline font-extrabold text-[9px] uppercase tracking-[.08em] transition-colors ${active ? 'text-primary' : 'text-outline'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
            {t(key)}
          </Link>
        )
      })}
    </nav>
  )
}
