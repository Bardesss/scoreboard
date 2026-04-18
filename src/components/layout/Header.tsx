'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Dices } from 'lucide-react'

export default function Header({ locale }: { locale: string }) {
  const t = useTranslations('common.nav')
  const pathname = usePathname()
  const isDark = pathname === `/${locale}` || pathname === '/'

  if (isDark) {
    return (
      <header className="sticky top-0 z-50" style={{ background: 'rgba(11,13,18,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(245,166,35,0.08)' }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: '#f5a623', boxShadow: '0 4px 16px rgba(245,166,35,0.35)' }}>
              <Dices size={18} strokeWidth={2.2} style={{ color: '#0b0d12' }} />
            </div>
            <div>
              <div className="font-headline font-black text-[14.5px] tracking-[-0.02em] leading-none" style={{ color: '#ede8dd' }}>Dice Vault</div>
              <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] leading-none mt-0.5" style={{ color: '#4a5568' }}>dicevault.fun</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href={`/${locale}/auth/login`} className="px-4 py-2 rounded-xl font-headline font-semibold text-[13.5px] transition-colors" style={{ color: '#7a8799' }}>
              {t('login')}
            </Link>
            <Link href={`/${locale}/auth/register`} className="px-4 py-2 rounded-[999px] font-headline font-bold text-[13px] transition-all" style={{ background: '#f5a623', color: '#0b0d12', boxShadow: '0 4px 14px rgba(245,166,35,0.3)' }}>
              {t('register')}
            </Link>
          </nav>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50" style={{ background: 'rgba(248,249,250,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(43,52,55,0.07)' }}>
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
            <Dices size={18} strokeWidth={2.2} className="text-on-primary" />
          </div>
          <div>
            <div className="font-headline font-black text-[14.5px] text-on-surface tracking-[-0.02em] leading-none">Dice Vault</div>
            <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant leading-none mt-0.5">dicevault.fun</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href={`/${locale}/auth/login`} className="px-4 py-2 rounded-xl font-headline font-semibold text-[13.5px] text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors">
            {t('login')}
          </Link>
          <Link href={`/${locale}/auth/register`} className="px-4 py-2 rounded-[999px] bg-primary text-on-primary font-headline font-bold text-[13px] transition-all hover:bg-primary-dim" style={{ boxShadow: '0 4px 14px rgba(0,91,192,0.24)' }}>
            {t('register')}
          </Link>
        </nav>
      </div>
    </header>
  )
}
