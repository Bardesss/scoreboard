'use client'
import { useTranslations } from 'next-intl'
import type { WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}


const fieldStyle: React.CSSProperties = {
  borderColor: '#e8e1d8',
  outline: 'none',
  background: '#fffdf9',
}

export function Step4Details({ state, onChange }: Props) {
  const t = useTranslations('app.games.wizard')

  return (
    <div className="space-y-4">
      <input
        value={state.description}
        onChange={e => onChange({ description: e.target.value })}
        placeholder={t('descriptionPlaceholder')}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm"
        style={fieldStyle}
        onFocus={e => (e.target.style.borderColor = '#f5a623')}
        onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
      />

      <div className="flex gap-3">
        <input
          type="number"
          min={1}
          value={state.minPlayers}
          onChange={e => onChange({ minPlayers: e.target.value })}
          placeholder={t('minPlayersPlaceholder')}
          className="flex-1 px-4 py-3 rounded-xl border font-body text-sm"
          style={fieldStyle}
          onFocus={e => (e.target.style.borderColor = '#f5a623')}
          onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
        />
        <input
          type="number"
          min={1}
          value={state.maxPlayers}
          onChange={e => onChange({ maxPlayers: e.target.value })}
          placeholder={t('maxPlayersPlaceholder')}
          className="flex-1 px-4 py-3 rounded-xl border font-body text-sm"
          style={fieldStyle}
          onFocus={e => (e.target.style.borderColor = '#f5a623')}
          onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
        />
      </div>

      <textarea
        value={state.scoringNotes}
        onChange={e => onChange({ scoringNotes: e.target.value })}
        placeholder={t('scoringNotesPlaceholder')}
        rows={4}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
        style={fieldStyle}
        onFocus={e => (e.target.style.borderColor = '#f5a623')}
        onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
      />

    </div>
  )
}
