'use client'

import { useActionState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { forgotPassword } from '../actions'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [state, formAction, pending] = useActionState(
    async (_: any, formData: FormData) => {
      formData.set('locale', locale)
      return forgotPassword(formData)
    },
    null
  )

  if (state?.success) {
    return (
      <AuthCard>
        <div className="text-center py-4">
          <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-3">{t('forgot.title')}</h1>
          <p className="font-body text-[14px] text-on-surface-variant mb-6">{t('forgot.sent')}</p>
          <Link href={`/${locale}/auth/login`} className="font-body text-[13px] text-primary hover:underline">{t('forgot.backToLogin')}</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('forgot.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('forgot.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('forgot.email')} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        {state?.error && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as any)}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('forgot.submit')}
        </PrimaryButton>
      </form>
      <div className="mt-6 text-center">
        <Link href={`/${locale}/auth/login`} className="font-body text-[13px] text-on-surface-variant hover:text-primary transition-colors">{t('forgot.backToLogin')}</Link>
      </div>
    </AuthCard>
  )
}
