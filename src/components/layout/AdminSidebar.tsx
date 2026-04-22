'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Settings, Globe, FileText, CheckSquare, Dices, MessageSquare, BarChart3, Receipt } from 'lucide-react'

const NAV = [
  { label: 'Dashboard',     href: '/admin',            icon: LayoutDashboard, exact: true },
  { label: 'Gebruikers',    href: '/admin/users',      icon: Users,           exact: false },
  { label: 'Instellingen',  href: '/admin/settings',   icon: Settings,        exact: false },
  { label: 'Landing',       href: '/admin/landing',    icon: Globe,           exact: false },
  { label: "Pagina's",      href: '/admin/pages',      icon: FileText,        exact: false },
  { label: 'Goedkeuringen', href: '/admin/approvals',  icon: CheckSquare,     exact: false },
  { label: 'Tickets',       href: '/admin/tickets',    icon: MessageSquare,   exact: false },
  { label: 'Credits',       href: '/admin/credits',    icon: BarChart3,       exact: false },
  { label: 'Belasting',     href: '/admin/billing/tax-export', icon: Receipt, exact: false },
] as const

export default function AdminSidebar() {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean): boolean {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0d1117',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px' }}>
        <div className="flex items-center gap-2.5">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#4a8eff',
              boxShadow: '0 4px 16px rgba(74,142,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Dices size={18} strokeWidth={2.2} style={{ color: '#fff' }} />
          </div>
          <div>
            <div
              className="font-headline font-black tracking-tight leading-none"
              style={{ color: 'rgba(255,255,255,0.87)', fontSize: 15 }}
            >
              Dice Vault
            </div>
            <div
              style={{
                marginTop: 4,
                display: 'inline-block',
                background: 'rgba(74,142,255,0.18)',
                color: '#4a8eff',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '1px 6px',
                borderRadius: 4,
                lineHeight: '14px',
              }}
            >
              Admin
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto' }}>
        {NAV.map(({ label, href, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 12,
                marginBottom: 2,
                fontSize: 13.5,
                fontWeight: active ? 600 : 400,
                color: active ? '#4a8eff' : 'rgba(255,255,255,0.6)',
                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)'
                  ;(e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.87)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)'
                }
              }}
            >
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <Link
          href="/app/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.35)',
            textDecoration: 'none',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.35)'
          }}
        >
          <span style={{ fontSize: 14 }}>&#8592;</span>
          Terug naar app
        </Link>
      </div>
    </aside>
  )
}
