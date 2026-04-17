'use client'

import { useActionState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { login } from '../actions'

export default function LoginPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [state, formAction, pending] = useActionState(
    async (_: any, formData: FormData) => {
      formData.set('locale', locale)
      return login(formData)
    },
    null
  )

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('login.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('login.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('login.email')} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <UnderlineInput label={t('login.password')} name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        {state?.error && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as any)}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('login.submit')}
        </PrimaryButton>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Link href={`/${locale}/auth/forgot-password`} className="font-body text-[13px] text-on-surface-variant hover:text-primary transition-colors">{t('login.forgotPassword')}</Link>
        <p className="font-body text-[13px] text-on-surface-variant">{t('login.noAccount')}{' '}<Link href={`/${locale}/auth/register`} className="text-primary font-semibold hover:underline">{t('login.register')}</Link></p>
      </div>
    </AuthCard>
  )
}
