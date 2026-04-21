'use client'
import { useTranslations } from 'next-intl'
import type { WizardState } from './wizard-types'

interface Props {
  state: WizardState
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid #e8e1d8' }}>
      <span className="font-body text-xs" style={{ color: '#9a8878' }}>{label}</span>
      <span className="font-headline font-bold text-xs ml-4 text-right" style={{ color: '#4a3f2f', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

export function Step5Confirm({ state }: Props) {
  const t = useTranslations('app.games.wizard')

  const winTypeLabel = state.winType
    ? t(`winTypeLabels.${state.winType}` as Parameters<typeof t>[0])
    : '—'

  const winConditionLabel = state.winCondition === 'high'
    ? t('winConditionHigh')
    : state.winCondition === 'low'
    ? t('winConditionLow')
    : null

  const playersLabel = (state.minPlayers || state.maxPlayers)
    ? `${state.minPlayers || '?'} – ${state.maxPlayers || '?'}`
    : '—'

  const scoreFieldsSummary = state.scoreFields.filter(Boolean).join(', ') || null

  return (
    <div className="space-y-5">
      {/* Preview card */}
      <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: `${state.color}22` }}
        >
          {state.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-headline font-black text-base" style={{ color: '#1c1810' }}>{state.name}</div>
          {state.description && (
            <div className="text-xs font-body mt-0.5 truncate" style={{ color: '#9a8878' }}>{state.description}</div>
          )}
        </div>
        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: state.color }} />
      </div>

      {/* Summary rows */}
      <div>
        <SummaryRow label={t('summaryWinType')} value={winTypeLabel} />
        {winConditionLabel && <SummaryRow label={t('summaryWinCondition')} value={winConditionLabel} />}
        {scoreFieldsSummary && <SummaryRow label={t('summaryScoreFields')} value={scoreFieldsSummary} />}
        <SummaryRow label={t('summaryPlayers')} value={playersLabel} />
      </div>

      {/* Credit cost notice */}
      <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
        {t('cost')}
      </div>
    </div>
  )
}
