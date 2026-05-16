'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FlagGB, FlagNL } from '@/components/shared/Flag'
import { setLocale } from '../actions'

const OPTIONS = [
  { value: 'en', Flag: FlagGB, name: 'English' },
  { value: 'nl', Flag: FlagNL, name: 'Nederlands' },
] as const

export function LanguageSection({ currentLocale }: { currentLocale: string }) {
  const t = useTranslations('app.settings.language')
  const router = useRouter()
  const { update } = useSession()
  const [pending, startTransition] = useTransition()
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const change = (locale: string) => {
    if (locale === currentLocale || pending) return
    startTransition(async () => {
      const result = await setLocale(locale)
      if (result.success) {
        await update({ locale })
        setSavedKey(locale)
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-3xl p-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
      <h2 className="font-headline font-black text-base mb-1" style={{ color: '#1c1810' }}>{t('title')}</h2>
      <p className="font-body text-sm mb-4" style={{ color: '#9a8878' }}>{t('description')}</p>

      <div role="radiogroup" style={{ display: 'flex', gap: 8 }}>
        {OPTIONS.map(opt => {
          const active = opt.value === currentLocale
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => change(opt.value)}
              disabled={pending}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 14,
                border: `1px solid ${active ? '#f5a623' : '#e8e1d8'}`,
                background: active ? '#fef3e2' : '#fffdf9',
                color: active ? '#1c1810' : '#9a8878',
                fontFamily: 'var(--font-headline)',
                fontWeight: active ? 800 : 600,
                fontSize: 14,
                cursor: pending ? 'progress' : 'pointer',
                transition: 'background 120ms, border-color 120ms, color 120ms',
              }}
            >
              <opt.Flag width={22} height={16} />
              {opt.name}
            </button>
          )
        })}
      </div>
      {savedKey === currentLocale && (
        <p className="mt-3 font-body text-xs" style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t('saved')}
        </p>
      )}
    </section>
  )
}
