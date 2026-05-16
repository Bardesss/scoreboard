'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'
import { setEmailPreferences } from '../actions'
import { EMAIL_PREFERENCE_KEYS, type EmailPreferenceKey, type EmailPreferences } from '@/lib/emailPreferences'

export function EmailPreferencesSection({ initial }: { initial: EmailPreferences }) {
  const t = useTranslations('app.settings.emailPrefs')
  const [prefs, setPrefs] = useState<EmailPreferences>(initial)
  const [pending, startTransition] = useTransition()

  function toggle(key: EmailPreferenceKey) {
    const next: EmailPreferences = { ...prefs, [key]: prefs[key] === false ? true : false }
    setPrefs(next)
    startTransition(async () => {
      const res = await setEmailPreferences(next)
      if (!res.success) {
        toast.error(t('errorSaving'))
        setPrefs(prefs)
      }
    })
  }

  return (
    <section className="rounded-3xl p-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
      <h2 className="font-headline font-black text-base mb-1" style={{ color: '#1c1810' }}>
        <Mail size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
        {t('title')}
      </h2>
      <p className="font-body text-sm mb-4" style={{ color: '#9a8878' }}>{t('description')}</p>

      <ul style={{ borderTop: '1px solid #f0ebe3' }}>
        {EMAIL_PREFERENCE_KEYS.map(key => {
          const enabled = prefs[key] !== false
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-3 py-3"
              style={{ borderBottom: '1px solid #f0ebe3' }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm" style={{ color: '#1c1810' }}>{t(`labels.${key}`)}</div>
                <div className="font-body text-xs mt-0.5" style={{ color: '#9a8878' }}>{t(`hints.${key}`)}</div>
              </div>
              <button
                type="button"
                onClick={() => toggle(key)}
                disabled={pending}
                aria-pressed={enabled}
                aria-label={t(`labels.${key}`)}
                className="flex-shrink-0 relative rounded-full transition-colors"
                style={{
                  width: 44,
                  height: 24,
                  background: enabled ? '#f5a623' : '#e8e1d8',
                  opacity: pending ? 0.7 : 1,
                  cursor: pending ? 'not-allowed' : 'pointer',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: enabled ? 23 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.18s',
                  }}
                />
              </button>
            </li>
          )
        })}
      </ul>

      <p className="font-body text-xs mt-3" style={{ color: '#9a8878' }}>{t('transactionalNote')}</p>
    </section>
  )
}
