'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const t = useTranslations('common.cookieBanner')
  const locale = useLocale()

  useEffect(() => {
    if (localStorage.getItem('cookie_consent') !== 'accepted') {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="max-w-xl mx-auto pointer-events-auto bg-surface-container-lowest rounded-2xl px-5 py-4 flex items-center justify-between gap-4" style={{ boxShadow: '0 8px 28px rgba(30,26,20,0.1)', border: '1px solid rgba(245,166,35,0.1)' }}>
        <p className="font-body text-[13px] text-on-surface-variant">
          {t('message')}{' '}
          <Link href={`/${locale}/p/privacy`} className="text-primary underline underline-offset-2">
            {t('readMore')}
          </Link>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 px-4 py-2 rounded-[10px] bg-primary text-on-primary font-headline font-bold text-[12px] hover:bg-primary-dim transition-colors"
        >
          {t('accept')}
        </button>
      </div>
    </div>
  )
}
