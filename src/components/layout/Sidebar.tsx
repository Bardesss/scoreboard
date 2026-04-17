'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Dices, ClipboardList, CreditCard, Settings } from 'lucide-react'

const NAV = [
  { key: 'dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { key: 'players',   href: '/app/players',   icon: Users },
  { key: 'games',     href: '/app/games',     icon: Dices },
  { key: 'sessions',  href: '/app/sessions',  icon: ClipboardList },
  { key: 'credits',   href: '/app/credits',   icon: CreditCard },
  { key: 'settings',  href: '/app/settings',  icon: Settings },
] as const

export default function Sidebar({ email, credits }: { email: string; credits: number }) {
  const pathname = usePathname()
  const t = useTranslations('app.nav')
  const tCredits = useTranslations('app.credits')

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white flex-col z-40" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
            <Dices size={18} strokeWidth={2.2} className="text-on-primary" />
          </div>
          <div>
            <div className="font-headline font-black text-[14.5px] text-on-surface tracking-[-0.02em] leading-none">Dice Vault</div>
            <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant leading-none mt-0.5">dicevault.fun</div>
          </div>
        </Link>
      </div>

      {/* Credit chip */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-container">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-headline font-bold text-[12px] text-primary">{tCredits('balance', { n: credits })}</span>
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
              className={`flex items-center gap-[11px] px-[14px] py-[10px] rounded-xl font-headline font-semibold text-[13.5px] transition-all ${active ? 'bg-white text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
              style={active ? { boxShadow: '0 2px 12px rgba(43,52,55,0.09)' } : {}}
            >
              <Icon size={17} className="flex-shrink-0" />
              {t(key)}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-4">
        <div className="flex items-center gap-2.5 p-3 rounded-[14px] bg-surface-container-low">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="font-headline font-black text-[11px] text-on-primary tracking-[.02em]">
              {email.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-body font-bold text-[12.5px] text-on-surface truncate">{email}</div>
            <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant">User</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
