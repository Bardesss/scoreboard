'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Dices } from 'lucide-react'

export default function Footer({ locale }: { locale: string }) {
  const t = useTranslations('landing.footer')
  const pathname = usePathname()
  const isDark = pathname === `/${locale}` || pathname === '/'

  if (isDark) {
    return (
      <footer className="py-12 mt-8" style={{ background: '#0b0d12', borderTop: '1px solid rgba(245,166,35,0.08)' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: '#f5a623', boxShadow: '0 4px 12px rgba(245,166,35,0.3)' }}>
                <Dices size={14} strokeWidth={2.2} style={{ color: '#0b0d12' }} />
              </div>
              <div>
                <div className="footer-brand-name font-headline font-black text-[13px] tracking-[-0.02em]" style={{ color: '#ede8dd' }}>Dice Vault</div>
                <div className="font-headline font-bold text-[7.5px] uppercase tracking-[.1em]" style={{ color: '#4a5568' }}>{t('tagline')}</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-[13px]" style={{ color: '#7a8799' }}>
              <Link href={`/${locale}/p/terms`} className="transition-colors hover:text-white" style={{ color: '#7a8799' }}>
                {locale === 'nl' ? 'Voorwaarden' : 'Terms'}
              </Link>
              <Link href={`/${locale}/p/privacy`} className="transition-colors hover:text-white" style={{ color: '#7a8799' }}>
                Privacy
              </Link>
            </div>
            <p className="text-[12px] font-body" style={{ color: '#4a5568' }}>
              © {new Date().getFullYear()} Dice Vault. {t('rights')}
            </p>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-surface-container py-12 mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-primary flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
              <Dices size={14} strokeWidth={2.2} className="text-on-primary" />
            </div>
            <div>
              <div className="font-headline font-black text-[13px] text-on-surface tracking-[-0.02em]">Dice Vault</div>
              <div className="font-headline font-bold text-[7.5px] uppercase tracking-[.1em] text-outline-variant">{t('tagline')}</div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-[13px] text-on-surface-variant">
            <Link href={`/${locale}/p/terms`} className="hover:text-on-surface transition-colors">
              {locale === 'nl' ? 'Voorwaarden' : 'Terms'}
            </Link>
            <Link href={`/${locale}/p/privacy`} className="hover:text-on-surface transition-colors">
              Privacy
            </Link>
          </div>
          <p className="text-[12px] text-outline-variant font-body">
            © {new Date().getFullYear()} Dice Vault. {t('rights')}
          </p>
        </div>
      </div>
    </footer>
  )
}
