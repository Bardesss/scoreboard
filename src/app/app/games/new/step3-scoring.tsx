'use client'
import { useTranslations } from 'next-intl'
import type { WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

function Toggle({ value, onToggle, label }: { value: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="font-body text-sm" style={{ color: '#4a3f2f' }}>{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? '#f5a623' : '#e8e1d8' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{ background: '#fff', left: value ? 'calc(100% - 22px)' : 2 }}
        />
      </button>
    </div>
  )
}

function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  addLabel: string
  removeLabel: string
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item}
            onChange={e => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-xl border font-body text-sm"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="px-3 py-2 rounded-xl font-headline font-bold text-xs"
            style={{ background: '#f0ebe3', color: '#9a8878' }}
          >
            {removeLabel}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="font-headline font-bold text-xs px-3 py-2 rounded-xl"
        style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}
      >
        {addLabel}
      </button>
    </div>
  )
}

export function Step3Scoring({ state, onChange }: Props) {
  const t = useTranslations('app.games.wizard')
  const wt = state.winType

  if (wt === 'points-all' || wt === 'points-winner') {
    return (
      <div className="space-y-5">
        <div>
          <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winConditionLabel')}</p>
          <div className="flex gap-2">
            {(['high', 'low'] as const).map(cond => (
              <button
                key={cond}
                type="button"
                onClick={() => onChange({ winCondition: cond })}
                className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm"
                style={{
                  background: state.winCondition === cond ? '#f5a623' : '#f0ebe3',
                  color: state.winCondition === cond ? '#1c1408' : '#4a3f2f',
                }}
              >
                {cond === 'high' ? t('winConditionHigh') : t('winConditionLow')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="font-headline font-bold text-xs mb-1" style={{ color: '#4a3f2f' }}>{t('scoreFieldsLabel')}</p>
          <p className="font-body text-xs mb-2" style={{ color: '#9a8878' }}>{t('scoreFieldsHint')}</p>
          <StringListEditor
            items={state.scoreFields}
            onChange={scoreFields => onChange({ scoreFields })}
            placeholder={t('fieldPlaceholder')}
            addLabel={t('addField')}
            removeLabel={t('removeField')}
          />
        </div>
      </div>
    )
  }

  if (wt === 'winner') {
    return (
      <div className="space-y-4">
        <Toggle
          value={state.rolesEnabled}
          onToggle={() => onChange({ rolesEnabled: !state.rolesEnabled, roles: [] })}
          label={t('rolesToggle')}
        />
        {state.rolesEnabled && (
          <div>
            <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('rolesLabel')}</p>
            <StringListEditor
              items={state.roles}
              onChange={roles => onChange({ roles })}
              placeholder={t('rolePlaceholder')}
              addLabel={t('addRole')}
              removeLabel={t('removeField')}
            />
          </div>
        )}
      </div>
    )
  }

  if (wt === 'secret-mission') {
    return (
      <div className="space-y-4">
        <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('missionsLabel')}</p>
        <StringListEditor
          items={state.missions.length > 0 ? state.missions : ['']}
          onChange={missions => onChange({ missions })}
          placeholder={t('missionPlaceholder')}
          addLabel={t('addMission')}
          removeLabel={t('removeField')}
        />
      </div>
    )
  }

  if (wt === 'cooperative') {
    return (
      <Toggle
        value={state.trackDifficulty}
        onToggle={() => onChange({ trackDifficulty: !state.trackDifficulty })}
        label={t('difficultyToggle')}
      />
    )
  }

  if (wt === 'team') {
    return (
      <Toggle
        value={state.trackTeamScores}
        onToggle={() => onChange({ trackTeamScores: !state.trackTeamScores })}
        label={t('teamScoresToggle')}
      />
    )
  }

  if (wt === 'time') {
    const options = [
      { value: 'seconds' as const, label: t('timeSeconds') },
      { value: 'minutes' as const, label: t('timeMinutes') },
      { value: 'mmss'    as const, label: t('timeMmss') },
    ]
    return (
      <div>
        <p className="font-headline font-bold text-xs mb-3" style={{ color: '#4a3f2f' }}>{t('timeUnitLabel')}</p>
        <div className="flex gap-2">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ timeUnit: o.value })}
              className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm"
              style={{
                background: state.timeUnit === o.value ? '#f5a623' : '#f0ebe3',
                color: state.timeUnit === o.value ? '#1c1408' : '#4a3f2f',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (wt === 'ranking') {
    return <p className="font-body text-sm leading-relaxed" style={{ color: '#9a8878' }}>{t('rankingInfo')}</p>
  }

  if (wt === 'elimination') {
    return (
      <div className="space-y-4">
        <p className="font-body text-sm leading-relaxed" style={{ color: '#9a8878' }}>{t('eliminationInfo')}</p>
        <Toggle
          value={state.trackEliminationOrder}
          onToggle={() => onChange({ trackEliminationOrder: !state.trackEliminationOrder })}
          label={t('trackEliminationOrderToggle')}
        />
      </div>
    )
  }

  return null
}
