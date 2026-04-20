'use client'
import { useTranslations } from 'next-intl'
import type { WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

const CURRENCIES = ['€', '$', '£', 'kr', 'pts']

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

      <div className="rounded-xl p-4 space-y-3" style={{ background: '#f9f5ee', border: '1px solid #e8e1d8' }}>
        <div className="flex items-center justify-between">
          <span className="font-headline font-bold text-sm" style={{ color: '#4a3f2f' }}>{t('buyInToggle')}</span>
          <button
            type="button"
            onClick={() => onChange({ buyInEnabled: !state.buyInEnabled })}
            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
            style={{ background: state.buyInEnabled ? '#f5a623' : '#e8e1d8' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
              style={{ background: '#fff', left: state.buyInEnabled ? 'calc(100% - 22px)' : 2 }}
            />
          </button>
        </div>

        {state.buyInEnabled && (
          <div>
            <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('buyInCurrencyLabel')}</p>
            <div className="flex gap-2 flex-wrap">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ buyInCurrency: c })}
                  className="px-4 py-2 rounded-xl font-headline font-bold text-sm"
                  style={{
                    background: state.buyInCurrency === c ? '#f5a623' : '#f0ebe3',
                    color: state.buyInCurrency === c ? '#1c1408' : '#4a3f2f',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
