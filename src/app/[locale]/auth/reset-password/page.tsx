'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { resetPassword } from '../actions'

export default function ResetPasswordPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      formData.set('token', token)
      return resetPassword(formData)
    },
    null
  )

  if (state && 'success' in state) {
    return (
      <AuthCard>
        <div className="text-center py-4">
          <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-3">{t('reset.success')}</h1>
          <Link href={`/${locale}/auth/login`} className="font-body text-[13px] text-primary hover:underline">{t('verify.login')}</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('reset.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('reset.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('reset.password')} name="password" type="password" autoComplete="new-password" required placeholder="••••••••" />
        <UnderlineInput label={t('reset.passwordConfirm')} name="passwordConfirm" type="password" autoComplete="new-password" required placeholder="••••••••" />
        {state && 'error' in state && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as Parameters<typeof t>[0])}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('reset.submit')}
        </PrimaryButton>
      </form>
    </AuthCard>
  )
}
