'use client'

import { useState, useTransition, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AVATAR_COLORS, AVATAR_ICONS } from '@/lib/avatarOptions'
import { updateAvatar, removeAvatar } from '../actions'

type Props = {
  initialColor: string | null
  initialIcon: string | null
}

export function AvatarSection({ initialColor, initialIcon }: Props) {
  const t = useTranslations('app.profile')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [color, setColor] = useState<string>(initialColor ?? AVATAR_COLORS[0])
  const [icon, setIcon] = useState<string>(initialIcon ?? AVATAR_ICONS[0])

  useEffect(() => {
    setColor(initialColor ?? AVATAR_COLORS[0])
    setIcon(initialIcon ?? AVATAR_ICONS[0])
  }, [initialColor, initialIcon])

  const hasCustom = initialIcon !== null

  function onSave() {
    startTransition(async () => {
      const res = await updateAvatar(color, icon)
      if (res.success) {
        toast.success(t('avatarSaved'))
        router.refresh()
      } else {
        toast.error(t('avatarError'))
      }
    })
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeAvatar()
      if (res.success) {
        toast.success(t('avatarRemoved'))
        router.refresh()
      } else {
        toast.error(t('avatarError'))
      }
    })
  }

  return (
    <section style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 16, color: '#1e1a14', marginBottom: 4 }}>
        {t('avatar')}
      </h2>
      <p className="font-body text-xs" style={{ color: '#9a8878', marginBottom: 14 }}>{t('avatarHint')}</p>

      {/* Preview */}
      <div
        style={{
          width: 56, height: 56, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, lineHeight: 1, marginBottom: 14,
        }}
      >
        {icon}
      </div>

      {/* Colour picker */}
      <p className="font-headline font-bold text-xs" style={{ color: '#4a3f2f', marginBottom: 8 }}>
        {t('avatarColorLabel')}
      </p>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 14 }}>
        {AVATAR_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="w-7 h-7 rounded-full transition-transform"
            style={{
              background: c,
              outlineOffset: 2,
              boxShadow: color === c ? '0 0 0 1px #fff, 0 0 0 3px ' + c : 'none',
              transform: color === c ? 'scale(1.2)' : 'scale(1)',
            }}
            aria-label={c}
          />
        ))}
      </div>

      {/* Icon picker */}
      <p className="font-headline font-bold text-xs" style={{ color: '#4a3f2f', marginBottom: 8 }}>
        {t('avatarIconLabel')}
      </p>
      <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 16 }}>
        {AVATAR_ICONS.map(ic => (
          <button
            key={ic}
            type="button"
            onClick={() => setIcon(ic)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
            style={{
              background: icon === ic ? 'rgba(245,166,35,0.15)' : 'transparent',
              border: icon === ic ? '1.5px solid #f5a623' : '1.5px solid transparent',
            }}
          >
            {ic}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408', opacity: pending ? 0.6 : 1 }}
        >
          {pending ? '…' : t('save')}
        </button>
        {hasCustom && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', opacity: pending ? 0.6 : 1 }}
          >
            {t('avatarRemove')}
          </button>
        )}
      </div>
    </section>
  )
}
