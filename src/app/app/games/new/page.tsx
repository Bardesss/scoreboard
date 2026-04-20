'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { createGameTemplate } from '../actions'
import { INITIAL_WIZARD_STATE, type WizardState } from './wizard-types'
import { resolveWinType } from './win-type-resolver'
import { Step1Basics } from './step1-basics'
import { Step2WinType } from './step2-win-type'
import { Step3Scoring } from './step3-scoring'
import { Step4Details } from './step4-details'
import { Step5Confirm } from './step5-confirm'

type Step = 1 | 2 | 3 | 4 | 5
const TOTAL_STEPS = 5

export default function NewGamePage() {
  const t = useTranslations('app.games.wizard')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE)
  const [loading, setLoading] = useState(false)

  function patch(update: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...update }))
  }

  function canAdvance(): boolean {
    if (step === 1) return state.name.trim().length > 0
    if (step === 2) return resolveWinType({ q1: state.q1, q2: state.q2, q3: state.q3 }).isComplete
    return true
  }

  function handleNext() {
    if (!canAdvance()) {
      if (step === 1) toast.error(tErrors('required'))
      return
    }
    if (step === 2) {
      const resolved = resolveWinType({ q1: state.q1, q2: state.q2, q3: state.q3 })
      setState(prev => ({ ...prev, winType: resolved.winType, rolesEnabled: resolved.rolesEnabled }))
    }
    setStep(s => (s + 1) as Step)
  }

  async function handleSubmit() {
    setLoading(true)
    const result = await createGameTemplate({
      name: state.name,
      color: state.color,
      icon: state.icon,
      winType: state.winType!,
      winCondition: state.winCondition,
      scoreFields: state.scoreFields.filter(Boolean),
      roles: state.roles.filter(Boolean),
      missions: state.missions.filter(Boolean),
      trackDifficulty: state.trackDifficulty,
      trackTeamScores: state.trackTeamScores,
      timeUnit: state.timeUnit,
      description: state.description,
      minPlayers: state.minPlayers ? parseInt(state.minPlayers, 10) : null,
      maxPlayers: state.maxPlayers ? parseInt(state.maxPlayers, 10) : null,
      scoringNotes: state.scoringNotes,
      buyInEnabled: state.buyInEnabled,
      buyInCurrency: state.buyInEnabled ? state.buyInCurrency : null,
    })
    setLoading(false)
    if (!result.success) {
      toast.error(tErrors(result.error as never))
      return
    }
    toast.success(tToasts('templateCreated'))
    router.push('/app/games')
  }

  const stepTitles: Record<Step, string> = {
    1: t('step1Title'),
    2: t('step2Title'),
    3: t('step3Title'),
    4: t('step4Title'),
    5: t('step5Title'),
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-8">
        {([1, 2, 3, 4, 5] as Step[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center font-headline font-bold text-[11px]"
              style={{
                background: step >= s ? '#f5a623' : '#e8e1d8',
                color: step >= s ? '#1c1408' : '#9a8878',
              }}
            >
              {s}
            </div>
            {s < TOTAL_STEPS && (
              <div className="h-px w-5" style={{ background: step > s ? '#f5a623' : '#e8e1d8' }} />
            )}
          </div>
        ))}
        <span className="ml-2 font-headline font-semibold text-sm" style={{ color: '#4a3f2f' }}>
          {stepTitles[step]}
        </span>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        {step === 1 && <Step1Basics state={state} onChange={patch} />}
        {step === 2 && <Step2WinType state={state} onChange={patch} />}
        {step === 3 && <Step3Scoring state={state} onChange={patch} />}
        {step === 4 && <Step4Details state={state} onChange={patch} />}
        {step === 5 && <Step5Confirm state={state} />}
      </div>

      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button
            onClick={() => setStep(s => (s - 1) as Step)}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f0ebe3', color: '#4a3f2f' }}
          >
            <ChevronLeft size={16} /> {t('back')}
          </button>
        )}
        <div className="flex-1" />
        {step < TOTAL_STEPS ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{
              background: canAdvance() ? '#f5a623' : '#e8e1d8',
              color: canAdvance() ? '#1c1408' : '#9a8878',
            }}
          >
            {t('next')} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {loading ? t('creating') : t('confirm')}
          </button>
        )}
      </div>
    </div>
  )
}
