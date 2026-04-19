'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { logPlayedGame } from '../actions'

type Member = { id: string; player: { id: string; name: string } }

export default function LogGamePage() {
  const t = useTranslations('app.playedGames')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const router = useRouter()
  const { id: leagueId } = useParams<{ id: string }>()

  const [members, setMembers] = useState<Member[]>([])
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/app/leagues/${leagueId}/members`)
      .then(r => r.json())
      .then((data: Member[]) => {
        setMembers(data)
        const initial: Record<string, string> = {}
        data.forEach(m => { initial[m.player.id] = '' })
        setScores(initial)
      })
      .catch(() => {})
  }, [leagueId])

  async function handleSubmit() {
    const scoreEntries = members.map(m => ({
      playerId: m.player.id,
      score: parseInt(scores[m.player.id] ?? '0', 10) || 0,
    }))

    setLoading(true)
    const result = await logPlayedGame(leagueId, {
      playedAt: new Date(playedAt),
      notes,
      scores: scoreEntries,
    })
    setLoading(false)

    if (!result.success) { toast.error(tErrors(result.error as never)); return }
    toast.success(tToasts('gameSaved'))
    router.push(`/app/leagues/${leagueId}`)
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      <h1 className="font-headline font-black text-2xl mb-6" style={{ color: '#1c1810' }}>{t('log')}</h1>

      <div className="space-y-4 p-6 rounded-2xl mb-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        {/* Date */}
        <div>
          <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{t('playedAt')}</label>
          <input
            type="date"
            value={playedAt}
            onChange={e => setPlayedAt(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        </div>

        {/* Scores */}
        <div>
          <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('scores')}</label>
          <ul className="space-y-2">
            {members.map(m => (
              <li key={m.id} className="flex items-center gap-3">
                <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
                <input
                  type="number"
                  value={scores[m.player.id] ?? ''}
                  onChange={e => setScores(prev => ({ ...prev, [m.player.id]: e.target.value }))}
                  placeholder={t('scorePlaceholder')}
                  className="w-28 px-3 py-2 rounded-xl border font-headline font-bold text-sm text-right"
                  style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
                  onFocus={e => (e.target.style.borderColor = '#f5a623')}
                  onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{t('notes')}</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        </div>

        {/* Cost reminder */}
        <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
          {t('cost')}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
        style={{ background: '#f5a623', color: '#1c1408' }}
      >
        {loading ? t('submitting') : t('submit')}
      </button>
    </div>
  )
}
