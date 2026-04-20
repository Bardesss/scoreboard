'use client'
import { useTranslations } from 'next-intl'
import { COLORS, ICONS, type WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

export function Step1Basics({ state, onChange }: Props) {
  const t = useTranslations('app.games.wizard')

  return (
    <div className="space-y-6">
      <div>
        <input
          autoFocus
          value={state.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder={t('namePlaceholder')}
          className="w-full px-4 py-3 rounded-xl border font-body text-sm"
          style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
          onFocus={e => (e.target.style.borderColor = '#f5a623')}
          onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
        />
      </div>

      <div>
        <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('colorLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              className="w-7 h-7 rounded-full transition-transform"
              style={{
                background: c,
                outline: state.color === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
                boxShadow: state.color === c ? '0 0 0 1px #fff, 0 0 0 3px ' + c : 'none',
                transform: state.color === c ? 'scale(1.2)' : 'scale(1)',
              }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('iconLabel')}</p>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map(icon => (
            <button
              key={icon}
              type="button"
              onClick={() => onChange({ icon })}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
              style={{
                background: state.icon === icon ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: state.icon === icon ? '1.5px solid #f5a623' : '1.5px solid transparent',
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
