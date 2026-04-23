'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { register } from '../actions'

type UsernameStatus = 'idle' | 'checking' | 'invalid' | 'taken' | 'available'

const USERNAME_RE = /^[a-z0-9_]{3,20}$/
const MIN_PW_LENGTH = 11

export default function RegisterPage() {
  const t = useTranslations('auth')
  const locale = useLocale()

  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [state, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      formData.set('locale', locale)
      formData.set('username', username)
      return register(formData)
    },
    null,
  )

  useEffect(() => {
    const normalized = username.trim().toLowerCase()
    if (!normalized) { setUsernameStatus('idle'); return }
    if (!USERNAME_RE.test(normalized)) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/username-available?name=${encodeURIComponent(normalized)}`)
        const data = (await r.json()) as { available: boolean; error?: string }
        if (data.error === 'invalid') setUsernameStatus('invalid')
        else setUsernameStatus(data.available ? 'available' : 'taken')
      } catch {
        setUsernameStatus('idle')
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [username])

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

  const pwLong = password.length >= MIN_PW_LENGTH
  const pwMatches = password.length > 0 && password === passwordConfirm
  const canSubmit = usernameStatus === 'available' && pwLong && pwMatches

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('register.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('register.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('register.name')} name="name" type="text" autoComplete="name" required placeholder={t('register.namePlaceholder')} />

        <UnderlineInput
          label={t('register.username')}
          name="username_display"
          type="text"
          autoComplete="username"
          required
          placeholder={t('register.usernamePlaceholder')}
          value={username}
          onChange={e => setUsername(e.target.value.toLowerCase())}
        />
        <UsernameFeedback status={usernameStatus} t={t} />

        <UnderlineInput label={t('register.email')} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />

        <UnderlineInput
          label={t('register.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <PwRule ok={pwLong} label={t('register.pwRuleLength', { count: MIN_PW_LENGTH })} />

        <UnderlineInput
          label={t('register.passwordConfirm')}
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          value={passwordConfirm}
          onChange={e => setPasswordConfirm(e.target.value)}
        />
        {passwordConfirm.length > 0 && (
          <PwRule ok={pwMatches} label={t('register.pwRuleMatch')} />
        )}

        {state && 'error' in state ? (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error.replace(/^auth\./, '') as Parameters<typeof t>[0])}</p>
        ) : null}

        <PrimaryButton type="submit" disabled={pending || !canSubmit} className="mt-2">
          {pending ? '…' : t('register.submit')}
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center font-body text-[13px] text-on-surface-variant">{t('register.hasAccount')}{' '}<Link href={`/${locale}/auth/login`} className="text-primary font-semibold hover:underline">{t('register.login')}</Link></p>
    </AuthCard>
  )
}

function UsernameFeedback({ status, t }: { status: UsernameStatus; t: ReturnType<typeof useTranslations> }) {
  if (status === 'idle') return null
  const { color, label } = (() => {
    switch (status) {
      case 'checking':  return { color: '#9a8878', label: t('register.usernameChecking') }
      case 'invalid':   return { color: '#c47f00', label: t('register.usernameInvalid') }
      case 'taken':     return { color: '#c0392b', label: t('register.usernameTaken') }
      case 'available': return { color: '#1a7a42', label: t('register.usernameAvailable') }
    }
  })()
  return <p className="font-body text-[12px] mb-3 -mt-3" style={{ color }}>{label}</p>
}

function PwRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className="font-body text-[12px] mb-3 -mt-3" style={{ color: ok ? '#1a7a42' : '#9a8878' }}>
      {ok ? '✓' : '○'} {label}
    </p>
  )
}
