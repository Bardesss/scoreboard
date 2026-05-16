'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Mail, CalendarDays, Trash2 } from 'lucide-react'
import { deleteAccount } from '../actions'

export function AccountSection({
  email,
  createdAt,
  locale,
}: {
  email: string
  createdAt: string
  locale: 'nl' | 'en'
}) {
  const t = useTranslations('app.settings.account')
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [pending, startTransition] = useTransition()

  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'
  const createdAtLabel = new Date(createdAt).toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!password || pending) return
    startTransition(async () => {
      const res = await deleteAccount(password)
      if (!res.success) {
        if (res.error === 'current_password_wrong') {
          toast.error(t('errorWrongPassword'))
        } else {
          toast.error(t('errorUnknown'))
        }
        return
      }
      // The server action calls signOut + redirect — we shouldn't normally
      // get here, but if we do the page will reload to /login.
    })
  }

  return (
    <section className="rounded-3xl p-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
      <h2 className="font-headline font-black text-base mb-1" style={{ color: '#1c1810' }}>{t('title')}</h2>
      <p className="font-body text-sm mb-4" style={{ color: '#9a8878' }}>{t('description')}</p>

      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#f5f0e8' }}>
          <Mail size={16} style={{ color: '#9a8878', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <div className="font-body text-xs" style={{ color: '#9a8878' }}>{t('emailLabel')}</div>
            <div className="font-body text-sm truncate" style={{ color: '#1c1810' }}>{email}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#f5f0e8' }}>
          <CalendarDays size={16} style={{ color: '#9a8878', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <div className="font-body text-xs" style={{ color: '#9a8878' }}>{t('createdAtLabel')}</div>
            <div className="font-body text-sm" style={{ color: '#1c1810' }}>{createdAtLabel}</div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #f0ebe3', paddingTop: 18 }}>
        <h3 className="font-headline font-bold text-sm mb-1" style={{ color: '#dc2626' }}>{t('deleteHeading')}</h3>
        <p className="font-body text-xs mb-3" style={{ color: '#9a8878' }}>{t('deleteWarning')}</p>

        {confirming ? (
          <form onSubmit={handleDelete} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('deletePasswordPlaceholder')}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl font-body text-sm outline-none"
              style={{ background: '#fff', border: '1px solid #dc2626', color: '#1c1810' }}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending || !password}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-headline font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#dc2626', color: '#fff', flex: 1 }}
              >
                <Trash2 size={15} />
                {pending ? t('deletingButton') : t('deleteConfirmButton')}
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); setPassword('') }}
                disabled={pending}
                className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
                style={{ background: '#f0ebe3', color: '#4a3f2f' }}
              >
                {t('cancelButton')}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #dc2626' }}
          >
            <Trash2 size={15} />
            {t('deleteButton')}
          </button>
        )}
      </div>
    </section>
  )
}
