'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { LogOut } from 'lucide-react'
import { logout } from '@/app/app/settings/actions'

export function LogoutIconButton() {
  const t = useTranslations('app.settings.logout')
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      title={t('button')}
      aria-label={t('button')}
      disabled={pending}
      onClick={() => startTransition(() => { logout() })}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
      style={{
        color: pending ? '#4a3f2f' : '#9a8878',
        background: 'transparent',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.12)'; (e.currentTarget as HTMLElement).style.color = '#fca5a5' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = pending ? '#4a3f2f' : '#9a8878' }}
    >
      <LogOut size={15} strokeWidth={2.2} />
    </button>
  )
}
