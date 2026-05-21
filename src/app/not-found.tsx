import Link from 'next/link'
import { Dices } from 'lucide-react'
import { cookies, headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'

// The global 404 boundary renders outside the [locale] route, so there is no
// route param to read the locale from. Fall back to the NEXT_LOCALE cookie
// (set by the next-intl middleware), then Accept-Language, then the default.
async function resolveLocale(): Promise<string> {
  const locales = routing.locales as readonly string[]

  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  if (cookieLocale && locales.includes(cookieLocale)) return cookieLocale

  const acceptLang = (await headers()).get('accept-language')
  if (acceptLang) {
    const tags = acceptLang.toLowerCase().split(',').map(s => s.split(';')[0].trim().slice(0, 2))
    for (const tag of tags) {
      if (locales.includes(tag)) return tag
    }
  }

  return routing.defaultLocale
}

export default async function NotFound() {
  const locale = await resolveLocale()
  const t = await getTranslations({ locale, namespace: 'common.notFound' })

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#faf7f2' }}>
      <div className="max-w-md w-full text-center">
        <Link href={`/${locale}`} className="inline-flex items-center gap-2.5 mb-10">
          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: '#f5a623', boxShadow: '0 4px 16px rgba(245,166,35,0.3)' }}>
            <Dices size={20} strokeWidth={2.2} style={{ color: '#1c1408' }} />
          </div>
          <div className="text-left">
            <div className="font-headline font-black text-[16px] tracking-[-0.02em] leading-none" style={{ color: '#1e1a14' }}>Dice Vault</div>
            <div className="font-headline font-bold text-[9px] uppercase tracking-[.1em] leading-none mt-0.5" style={{ color: '#9a8878' }}>dicevault.fun</div>
          </div>
        </Link>

        <div className="rounded-3xl p-10" style={{ background: '#fefcf8', border: '1px solid #e8e1d8', boxShadow: '0 2px 16px rgba(30,26,20,0.06)' }}>
          <p className="font-headline font-black text-[64px] leading-none mb-2" style={{ color: '#f5a623' }}>404</p>
          <h1 className="font-headline font-black text-[22px] tracking-[-0.02em] mb-2" style={{ color: '#1e1a14' }}>{t('title')}</h1>
          <p className="font-body text-[14px] mb-8" style={{ color: '#7a6b56' }}>
            {t('body')}
          </p>
          <Link
            href={`/${locale}`}
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl font-headline font-bold text-[14px]"
            style={{ background: '#f5a623', color: '#1c1408', boxShadow: '0 4px 14px rgba(245,166,35,0.28)' }}
          >
            {t('backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
