'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { changePassword } from '../actions'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#f5f0e8',
  border: '1px solid #e8e1d8',
  borderRadius: 12,
  color: '#1c1810',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
}

export function PasswordSection() {
  const t = useTranslations('app.settings.password')
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    async (_: unknown, fd: FormData) => changePassword(fd),
    null
  )

  useEffect(() => {
    if (state?.success) formRef.current?.reset()
  }, [state])

  const errorMessage = (() => {
    if (!state || state.success) return null
    switch (state.error) {
      case 'missing_fields': return t('errorMissing')
      case 'current_password_wrong': return t('errorWrong')
      case 'password_too_short': return t('errorShort')
      case 'password_mismatch': return t('errorMismatch')
      case 'password_unchanged': return t('errorUnchanged')
      default: return t('errorUnknown')
    }
  })()

  return (
    <section className="rounded-3xl p-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
      <h2 className="font-headline font-black text-base mb-1" style={{ color: '#1c1810' }}>{t('title')}</h2>
      <p className="font-body text-sm mb-4" style={{ color: '#9a8878' }}>{t('description')}</p>

      <form ref={formRef} action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="font-headline font-semibold text-xs block mb-1.5" style={{ color: '#9a8878' }}>{t('current')}</label>
          <input type="password" name="currentPassword" autoComplete="current-password" required style={inputStyle} />
        </div>
        <div>
          <label className="font-headline font-semibold text-xs block mb-1.5" style={{ color: '#9a8878' }}>{t('new')}</label>
          <input type="password" name="newPassword" autoComplete="new-password" minLength={11} required style={inputStyle} />
        </div>
        <div>
          <label className="font-headline font-semibold text-xs block mb-1.5" style={{ color: '#9a8878' }}>{t('confirm')}</label>
          <input type="password" name="confirmPassword" autoComplete="new-password" minLength={11} required style={inputStyle} />
        </div>
        {errorMessage && (
          <p className="font-body text-xs" style={{ color: '#dc2626' }}>{errorMessage}</p>
        )}
        {state?.success && (
          <p className="font-body text-xs" style={{ color: '#16a34a' }}>{t('successToast')}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="font-headline font-bold text-sm rounded-xl py-2.5 px-5 self-start mt-1"
          style={{ background: '#f5a623', color: '#1c1408', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}
        >
          {pending ? '…' : t('submit')}
        </button>
      </form>
    </section>
  )
}
