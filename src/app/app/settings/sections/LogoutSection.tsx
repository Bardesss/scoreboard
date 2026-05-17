'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { LogOut } from 'lucide-react'
import { logout } from '../actions'

export function LogoutSection() {
  const t = useTranslations('app.settings.logout')
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(() => {
      logout()
    })
  }

  return (
    <section className="rounded-3xl p-6" style={{ background: '#fefcf8', border: '1px solid #e8e1d8' }}>
      <h2 className="font-headline font-black text-base mb-1" style={{ color: '#1e1a14' }}>{t('title')}</h2>
      <p className="font-body text-sm mb-4" style={{ color: '#9a8878' }}>{t('description')}</p>

      {confirming ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleLogout}
            disabled={pending}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-headline font-bold text-sm transition-transform active:scale-95"
            style={{ background: '#dc2626', color: '#fff', flex: 1, opacity: pending ? 0.7 : 1 }}
          >
            <LogOut size={15} />
            {pending ? t('signingOut') : t('confirm')}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f0ebe3', color: '#4a3f2f' }}
          >
            {t('cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#fef3e2', color: '#1e1a14', border: '1px solid #f5a623' }}
        >
          <LogOut size={15} />
          {t('button')}
        </button>
      )}
    </section>
  )
}
