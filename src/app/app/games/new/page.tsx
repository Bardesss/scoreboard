'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createGameTemplate } from '../actions'
import { ChevronRight, ChevronLeft, Dices } from 'lucide-react'

type Step = 1 | 2 | 3

export default function NewGamePage() {
  const t = useTranslations('app.games.wizard')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scoringNotes, setScoringNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    const result = await createGameTemplate({ name, description, scoringNotes })
    setLoading(false)
    if (!result.success) {
      toast.error(tErrors(result.error as never))
      return
    }
    toast.success(tToasts('templateCreated'))
    router.push('/app/games')
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-headline font-bold text-xs"
              style={{
                background: step >= s ? '#f5a623' : '#e8e1d8',
                color: step >= s ? '#1c1408' : '#9a8878',
              }}
            >
              {s}
            </div>
            {s < 3 && <div className="h-px flex-1 w-8" style={{ background: step > s ? '#f5a623' : '#e8e1d8' }} />}
          </div>
        ))}
        <span className="ml-2 font-headline font-semibold text-sm" style={{ color: '#4a3f2f' }}>
          {step === 1 ? t('step1Title') : step === 2 ? t('step2Title') : t('step3Title')}
        </span>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        {step === 1 && (
          <div className="space-y-4">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              onFocus={e => (e.target.style.borderColor = '#f5a623')}
              onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              className="w-full px-4 py-3 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              onFocus={e => (e.target.style.borderColor = '#f5a623')}
              onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
            />
          </div>
        )}

        {step === 2 && (
          <textarea
            autoFocus
            value={scoringNotes}
            onChange={e => setScoringNotes(e.target.value)}
            placeholder={t('scoringNotesPlaceholder')}
            rows={6}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                <Dices size={18} style={{ color: '#f5a623' }} />
              </div>
              <div>
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{name}</div>
                {description && <div className="text-xs font-body mt-0.5" style={{ color: '#9a8878' }}>{description}</div>}
                {scoringNotes && <div className="text-xs font-body mt-1 italic" style={{ color: '#9a8878' }}>{scoringNotes}</div>}
              </div>
            </div>
            <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
              {t('cost')}
            </div>
          </div>
        )}
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
        {step < 3 ? (
          <button
            onClick={() => {
              if (step === 1 && !name.trim()) { toast.error('Name is required'); return }
              setStep(s => (s + 1) as Step)
            }}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f5a623', color: '#1c1408' }}
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
