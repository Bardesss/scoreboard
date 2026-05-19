'use client'

import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, PasswordInput, PrimaryButton } from '@/components/auth/AuthCard'
import { resetPassword } from '../actions'

const MIN_PW_LENGTH = 11

export default function ResetPasswordPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

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

  const pwLong = password.length >= MIN_PW_LENGTH
  const pwMatches = password.length > 0 && password === passwordConfirm

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('reset.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('reset.subtitle')}</p>
      <form action={formAction}>
        <PasswordInput
          label={t('reset.password')}
          name="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          showLabel={t('register.pwShow')}
          hideLabel={t('register.pwHide')}
        />
        <PwRule
          state={pwLong ? 'ok' : password.length > 0 ? 'progress' : 'pending'}
          label={
            pwLong
              ? t('register.pwRuleLength', { count: MIN_PW_LENGTH })
              : t('register.pwRuleLengthProgress', { count: password.length, min: MIN_PW_LENGTH })
          }
        />
        <PasswordInput
          label={t('reset.passwordConfirm')}
          name="passwordConfirm"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          value={passwordConfirm}
          onChange={e => setPasswordConfirm(e.target.value)}
          showLabel={t('register.pwShow')}
          hideLabel={t('register.pwHide')}
        />
        {passwordConfirm.length > 0 && (
          <PwRule
            state={pwMatches ? 'ok' : 'fail'}
            label={pwMatches ? t('register.pwRuleMatch') : t('register.pwRuleMatchFail')}
          />
        )}
        {state && 'error' in state ? (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error.replace(/^auth\./, '') as Parameters<typeof t>[0])}</p>
        ) : null}
        <PrimaryButton type="submit" disabled={pending || !pwLong || !pwMatches} className="mt-2">
          {pending ? '…' : t('reset.submit')}
        </PrimaryButton>
      </form>
    </AuthCard>
  )
}

function PwRule({ state, label }: { state: 'pending' | 'progress' | 'ok' | 'fail'; label: string }) {
  const color =
    state === 'ok'   ? '#1a7a42' :
    state === 'fail' ? '#c0392b' :
                       '#9a8878'
  const mark =
    state === 'ok'   ? '✓' :
    state === 'fail' ? '✗' :
                       '○'
  return (
    <p className="font-body text-[12px] mb-3 -mt-3" style={{ color }}>
      {mark} {label}
    </p>
  )
}
