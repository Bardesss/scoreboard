'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Settings, Globe, FileText, CheckSquare, Dices, MessageSquare, BarChart3, Receipt, Menu, X, ArrowLeft } from 'lucide-react'

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

export default function AdminMobileHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function isActive(href: string, exact: boolean): boolean {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      <header
        className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4"
        style={{ background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Link href="/admin" className="flex items-center gap-2">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 32, height: 32, borderRadius: 8, background: '#4a8eff', boxShadow: '0 4px 12px rgba(74,142,255,0.28)' }}
          >
            <Dices size={16} strokeWidth={2.2} style={{ color: '#fff' }} />
          </div>
          <span className="font-headline font-black text-[14px] tracking-[-0.02em]" style={{ color: 'rgba(255,255,255,0.87)' }}>
            Dice Vault
          </span>
          <span
            className="font-headline font-bold"
            style={{
              fontSize: 9,
              letterSpacing: '0.08em',
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(74,142,255,0.18)',
              color: '#4a8eff',
              textTransform: 'uppercase',
            }}
          >
            Admin
          </span>
        </Link>
        <button
          type="button"
          aria-label="Menu openen"
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Menu sluiten"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          />
          <aside
            className="relative flex flex-col"
            style={{
              width: 280,
              maxWidth: '85vw',
              height: '100vh',
              background: '#0d1117',
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex items-center justify-between" style={{ padding: '20px 20px 16px' }}>
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
              <button
                type="button"
                aria-label="Menu sluiten"
                onClick={() => setOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                <X size={20} />
              </button>
            </div>

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
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 12,
                      marginBottom: 2,
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      color: active ? '#4a8eff' : 'rgba(255,255,255,0.7)',
                      background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                      textDecoration: 'none',
                    }}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    {label}
                  </Link>
                )
              })}
            </nav>

            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <Link
                href="/app/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.6)',
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft size={14} />
                Terug naar app
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
