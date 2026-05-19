'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { updatePrivacySettings } from '../actions'

type Props = {
  initial: {
    publicProfileMode: 'private' | 'stats' | 'full'
    allowAppearInOthers: boolean
  }
}

export function PrivacySection({ initial }: Props) {
  const t = useTranslations('app.social')
  const [mode, setMode] = useState(initial.publicProfileMode)
  const [appear, setAppear] = useState(initial.allowAppearInOthers)
  const [, startTransition] = useTransition()

  const masterOn = mode !== 'private'

  function commit(next: { mode?: typeof mode; appear?: typeof appear }) {
    const nextMode = next.mode ?? mode
    const nextAppear = next.appear ?? appear
    startTransition(async () => {
      try {
        await updatePrivacySettings({ publicProfileMode: nextMode, allowAppearInOthers: nextAppear })
        toast.success(t('settingsSaved'))
      } catch {
        toast.error(t('settingsSaveFailed'))
      }
    })
  }

  function toggleMaster(on: boolean) {
    const newMode: typeof mode = on ? (mode === 'private' ? 'stats' : mode) : 'private'
    setMode(newMode)
    commit({ mode: newMode })
  }

  function pickSubMode(next: 'stats' | 'full') {
    setMode(next)
    commit({ mode: next })
  }

  function toggleAppear(on: boolean) {
    setAppear(on)
    commit({ appear: on })
  }

  return (
    <section id="privacy" style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 16, color: '#1e1a14', marginBottom: 16 }}>
        {t('publicProfileSectionHeading')}
      </h2>

      {/* Master toggle */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: '#f0ebe3' }}>
        <div className="flex-1 min-w-0">
          <p style={{ fontWeight: 600, fontSize: 14, color: '#1e1a14' }}>{t('publicProfileMasterToggle')}</p>
          <p style={{ fontSize: 12, color: '#6b5e4a', marginTop: 4 }}>{t('publicProfileMasterBody')}</p>
        </div>
        <Switch checked={masterOn} onChange={toggleMaster} />
      </div>

      {/* Sub-radio (dimmed when off) */}
      <fieldset disabled={!masterOn} style={{ opacity: masterOn ? 1 : 0.5, marginTop: 12, paddingBottom: 12, borderBottom: '1px solid #f0ebe3' }}>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="radio" name="publicMode" checked={mode === 'stats'} onChange={() => pickSubMode('stats')} />
          <span style={{ fontSize: 13, color: '#1e1a14' }}>{t('publicProfileModeStats')}</span>
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="radio" name="publicMode" checked={mode === 'full'} onChange={() => pickSubMode('full')} />
          <span style={{ fontSize: 13, color: '#1e1a14' }}>{t('publicProfileModeFull')}</span>
        </label>
      </fieldset>

      {/* Appear-in-others */}
      <div className="flex items-start justify-between gap-4 pt-4">
        <div className="flex-1 min-w-0">
          <p style={{ fontWeight: 600, fontSize: 14, color: '#1e1a14' }}>{t('appearInOthersToggle')}</p>
          <p style={{ fontSize: 12, color: '#6b5e4a', marginTop: 4 }}>{t('appearInOthersBody')}</p>
        </div>
        <Switch checked={appear} onChange={toggleAppear} />
      </div>
    </section>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999,
        background: checked ? '#f5a623' : '#d8cfc2',
        position: 'relative', transition: 'background 180ms',
        border: 'none', cursor: 'pointer', flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fefcf8',
          transition: 'left 180ms', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
