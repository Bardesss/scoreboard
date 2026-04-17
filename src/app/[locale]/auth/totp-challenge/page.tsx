'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { verifyTotp } from '../actions'

export default function TotpChallengePage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      formData.set('token', token)
      formData.set('locale', locale)
      return verifyTotp(formData)
    },
    null
  )

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('totp.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('totp.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput
          label={t('totp.code')}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={10}
          required
          placeholder="000000"
          autoFocus
        />
        {state?.error && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as Parameters<typeof t>[0])}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('totp.submit')}
        </PrimaryButton>
      </form>
    </AuthCard>
  )
}
