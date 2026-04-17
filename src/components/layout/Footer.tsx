import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Dices } from 'lucide-react'

export default function Footer({ locale }: { locale: string }) {
  const t = useTranslations('landing.footer')
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
