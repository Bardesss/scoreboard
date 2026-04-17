'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Dices, ClipboardList, Settings } from 'lucide-react'

const NAV = [
  { key: 'dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { key: 'players',   href: '/app/players',   icon: Users },
  { key: 'games',     href: '/app/games',     icon: Dices },
  { key: 'sessions',  href: '/app/sessions',  icon: ClipboardList },
  { key: 'settings',  href: '/app/settings',  icon: Settings },
] as const

export default function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('app.nav')

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-2 pb-safe" style={{ height: '56px', background: 'rgba(248,249,250,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid rgba(43,52,55,0.07)' }}>
      {NAV.map(({ key, href, icon: Icon }) => {
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
