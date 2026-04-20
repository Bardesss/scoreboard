'use client'
import { useTranslations } from 'next-intl'
import { resolveWinType } from './win-type-resolver'
import type { Q1Answer, Q2Answer, Q3Answer, WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

function optionBtn(active: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    borderRadius: 12,
    border: active ? '1.5px solid #f5a623' : '1.5px solid #e8e1d8',
    background: active ? 'rgba(245,166,35,0.08)' : '#fffdf9',
    color: active ? '#c47f00' : '#4a3f2f',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    display: 'block',
    transition: 'all 0.15s',
  }
}

export function Step2WinType({ state, onChange }: Props) {
  const t = useTranslations('app.games.wizard')

  function setQ1(q1: Q1Answer) {
    onChange({ q1, q2: null, q3: null, winType: null, rolesEnabled: false })
  }
  function setQ2(q2: Q2Answer) {
    onChange({ q2, q3: null, winType: null, rolesEnabled: false })
  }
  function setQ3(q3: Q3Answer) {
    const resolved = resolveWinType({ q1: state.q1, q2: state.q2, q3 })
    onChange({ q3, winType: resolved.winType, rolesEnabled: resolved.rolesEnabled })
  }

  const resolved = resolveWinType({ q1: state.q1, q2: state.q2, q3: state.q3 })
  const winTypeLabel = resolved.winType
    ? t(`winTypeLabels.${resolved.winType}` as Parameters<typeof t>[0])
    : null

  const q1Options: { value: Q1Answer; label: string }[] = [
    { value: 'points-all',    label: t('q1PointsAll') },
    { value: 'points-winner', label: t('q1PointsWinner') },
    { value: 'time',          label: t('q1Time') },
    { value: 'ranking',       label: t('q1Ranking') },
    { value: 'elimination',   label: t('q1Elimination') },
    { value: 'declaration',   label: t('q1Declaration') },
  ]

  const q2Options: { value: Q2Answer; label: string }[] = [
    { value: 'team',        label: t('q2Teams') },
    { value: 'cooperative', label: t('q2Cooperative') },
    { value: 'individual',  label: t('q2Individual') },
  ]

  const q3Options: { value: Q3Answer; label: string }[] = [
    { value: 'no',       label: t('q3No') },
    { value: 'roles',    label: t('q3Roles') },
    { value: 'missions', label: t('q3Missions') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="font-headline font-bold text-xs mb-3" style={{ color: '#4a3f2f' }}>{t('q1Label')}</p>
        <div className="space-y-2">
          {q1Options.map(o => (
            <button key={o.value} type="button" style={optionBtn(state.q1 === o.value)} onClick={() => setQ1(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {state.q1 === 'declaration' && (
        <div>
          <p className="font-headline font-bold text-xs mb-3" style={{ color: '#4a3f2f' }}>{t('q2Label')}</p>
          <div className="space-y-2">
            {q2Options.map(o => (
              <button key={o.value} type="button" style={optionBtn(state.q2 === o.value)} onClick={() => setQ2(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.q1 === 'declaration' && state.q2 === 'individual' && (
        <div>
          <p className="font-headline font-bold text-xs mb-3" style={{ color: '#4a3f2f' }}>{t('q3Label')}</p>
          <div className="space-y-2">
            {q3Options.map(o => (
              <button key={o.value} type="button" style={optionBtn(state.q3 === o.value)} onClick={() => setQ3(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {resolved.isComplete && winTypeLabel && (
        <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.25)', color: '#1a7a42' }}>
          {t('winTypeConfirmed', { label: winTypeLabel })}
        </div>
      )}

      <p className="text-xs font-body" style={{ color: '#9a8878' }}>{t('feedbackLink')}</p>
    </div>
  )
}
