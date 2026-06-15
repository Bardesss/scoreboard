'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronUp, CreditCard, LifeBuoy, LogOut, Settings, ShieldCheck, User } from 'lucide-react'
import { logout } from '@/app/app/settings/actions'

type Variant = 'sidebar' | 'mobile'

export function UserMenu({
  name,
  email,
  credits,
  isAdmin,
  variant,
  avatarColor,
  avatarIcon,
}: {
  name: string
  email: string
  credits: number
  isAdmin?: boolean
  variant: Variant
  avatarColor?: string | null
  avatarIcon?: string | null
}) {
  const t = useTranslations('app.nav')
  const tCredits = useTranslations('app.credits')
  const tLogout = useTranslations('app.settings.logout')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = name.slice(0, 2).toUpperCase()

  const trigger =
    variant === 'sidebar' ? (
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 p-3 rounded-[14px] w-full text-left transition-colors"
        style={{
          background: open ? 'rgba(245,166,35,0.12)' : 'rgba(245,166,35,0.06)',
          border: '1px solid rgba(245,166,35,0.08)',
        }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: avatarIcon ? (avatarColor ?? '#f5a623') : '#f5a623' }}>
          {avatarIcon ? (
            <span style={{ fontSize: 16, lineHeight: 1 }}>{avatarIcon}</span>
          ) : (
            <span className="font-headline font-black text-[11px] tracking-[.02em]" style={{ color: '#1c1408' }}>
              {initials}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-body font-bold text-[12.5px] truncate" style={{ color: '#f7f3ed' }}>{name}</div>
          <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em]" style={{ color: '#4a3f2f' }}>{t('vaultKeeper')}</div>
        </div>
        <ChevronUp
          size={14}
          strokeWidth={2.4}
          style={{ color: '#9a8878', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms' }}
        />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        className="relative w-9 h-9 rounded-full flex items-center justify-center"
        style={{
          background: avatarIcon ? (avatarColor ?? '#f5a623') : '#f5a623',
          boxShadow: open ? '0 0 0 2px rgba(245,166,35,0.4)' : '0 2px 8px rgba(245,166,35,0.25)',
          transition: 'box-shadow 160ms',
        }}
      >
        {avatarIcon ? (
          <span style={{ fontSize: 18, lineHeight: 1 }}>{avatarIcon}</span>
        ) : (
          <span className="font-headline font-black text-[12px] tracking-[.02em]" style={{ color: '#1c1408' }}>
            {initials}
          </span>
        )}
      </button>
    )

  const popoverPosition =
    variant === 'sidebar'
      ? 'left-0 bottom-full mb-2'
      : 'right-0 top-full mt-2'

  return (
    <div ref={wrapperRef} className="relative">
      {trigger}

      {open && (
        <div
          role="menu"
          className={`absolute w-64 rounded-2xl shadow-xl z-50 overflow-hidden ${popoverPosition}`}
          style={{ background: '#fefcf8', border: '1px solid #e8e1d8' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #f0ebe3' }}>
            <div className="font-body font-bold text-[13px] truncate" style={{ color: '#1e1a14' }}>{name}</div>
            <div className="font-body text-[11.5px] truncate" style={{ color: '#9a8878' }}>{email}</div>
          </div>

          <ul className="py-1">
            <MenuLink href="/app/credits" icon={CreditCard} label={t('credits')} suffix={tCredits('balance', { n: credits })} onNavigate={() => setOpen(false)} />
            <MenuLink href="/app/profile" icon={User} label={t('profile')} onNavigate={() => setOpen(false)} />
            <MenuLink href="/app/settings" icon={Settings} label={t('settings')} onNavigate={() => setOpen(false)} />
            <MenuLink href="/app/support" icon={LifeBuoy} label={t('support')} onNavigate={() => setOpen(false)} />
            {isAdmin && (
              <MenuLink href="/admin" icon={ShieldCheck} label="Admin" onNavigate={() => setOpen(false)} accent="#4a8eff" />
            )}
          </ul>

          <div style={{ borderTop: '1px solid #f0ebe3' }}>
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => startTransition(() => { logout() })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 font-body text-[13px] font-semibold transition-colors enabled:hover:bg-[rgba(220,38,38,0.06)] enabled:focus-visible:bg-[rgba(220,38,38,0.06)]"
              style={{ color: pending ? '#9a8878' : '#dc2626' }}
            >
              <LogOut size={15} strokeWidth={2.2} />
              {pending ? tLogout('signingOut') : tLogout('button')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuLink({
  href,
  icon: Icon,
  label,
  suffix,
  onNavigate,
  accent,
}: {
  href: string
  icon: typeof CreditCard
  label: string
  suffix?: string
  onNavigate: () => void
  accent?: string
}) {
  const color = accent ?? '#1e1a14'
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        role="menuitem"
        className="flex items-center gap-2.5 px-4 py-2.5 font-body text-[13px] font-semibold transition-colors hover:bg-[rgba(245,166,35,0.08)] focus-visible:bg-[rgba(245,166,35,0.08)]"
        style={{ color }}
      >
        <Icon size={15} strokeWidth={2.2} className="flex-shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {suffix && (
          <span className="font-headline font-bold text-[11px]" style={{ color: '#f5a623' }}>{suffix}</span>
        )}
      </Link>
    </li>
  )
}
