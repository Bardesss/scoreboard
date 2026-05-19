'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { updateUsername } from '../actions'

type Props = {
  initial: string | null
}

export function UsernameSection({ initial }: Props) {
  const t = useTranslations('app.profile')
  const [state, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => updateUsername(formData),
    null,
  )

  return (
    <section style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 16, color: '#1e1a14', marginBottom: 12 }}>
        {t('username')}
      </h2>
      <form action={formAction} className="flex gap-2">
        <input
          name="username"
          defaultValue={initial ?? ''}
          placeholder="e.g. jan_de_vries"
          className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm outline-none"
          style={{ background: '#f5f0e8', border: '1px solid #e8e1d8', color: '#1e1a14' }}
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          {pending ? '…' : t('save')}
        </button>
      </form>
      {state && 'success' in state && state.success && (
        <p className="mt-2 font-body text-xs" style={{ color: '#16a34a' }}>{t('usernameSaved')}</p>
      )}
      {state && 'success' in state && !state.success && (
        <p className="mt-2 font-body text-xs" style={{ color: '#dc2626' }}>{state.error}</p>
      )}
      <p className="mt-2 font-body text-xs" style={{ color: '#9a8878' }}>{t('usernameHint')}</p>
    </section>
  )
}
