'use client'

import { useActionState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { register } from '../actions'

export default function RegisterPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [state, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      formData.set('locale', locale)
      return register(formData)
    },
    null
  )

  if (state && 'success' in state) {
    return (
      <AuthCard>
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center mx-auto mb-4">
            <div className="w-3 h-3 rounded-full bg-primary" />
          </div>
          <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-2">{t('register.checkEmail')}</h1>
          <p className="font-body text-[14px] text-on-surface-variant">{t('verify.title')}</p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('register.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('register.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('register.email')} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <UnderlineInput label={t('register.password')} name="password" type="password" autoComplete="new-password" required placeholder="••••••••" />
        <UnderlineInput label={t('register.passwordConfirm')} name="passwordConfirm" type="password" autoComplete="new-password" required placeholder="••••••••" />
        {state && 'error' in state && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as Parameters<typeof t>[0])}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('register.submit')}
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center font-body text-[13px] text-on-surface-variant">{t('register.hasAccount')}{' '}<Link href={`/${locale}/auth/login`} className="text-primary font-semibold hover:underline">{t('register.login')}</Link></p>
    </AuthCard>
  )
}
