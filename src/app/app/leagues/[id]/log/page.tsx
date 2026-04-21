'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { logPlayedGame } from '../actions'
import type { WinType } from '@/app/app/games/new/wizard-types'

type Member = { id: string; player: { id: string; name: string } }

const SCORE_BASED_TYPES: WinType[] = ['points-all', 'points-winner', 'time', 'ranking']

export default function LogGamePage() {
  const t = useTranslations('app.playedGames')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const router = useRouter()
  const { id: leagueId } = useParams<{ id: string }>()

  const [members, setMembers] = useState<Member[]>([])
  const [winType, setWinType] = useState<WinType>('points-all')
  const [missions, setMissions] = useState<string[]>([])
  const [scoreFields, setScoreFields] = useState<string[]>([])
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  // scores[playerId][fieldIndex] — single total when no fields defined (fieldIndex 0)
  const [scores, setScores] = useState<Record<string, string[]>>({})
  const [winnerId, setWinnerId] = useState<string>('')
  const [winningMission, setWinningMission] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/app/leagues/${leagueId}/members`)
      .then(r => r.json())
      .then((data: { members: Member[]; winType: WinType; missions: string[]; scoreFields: string[] }) => {
        setMembers(data.members)
        setWinType(data.winType)
        setMissions(data.missions ?? [])
        const fields = data.scoreFields ?? []
        setScoreFields(fields)
        const fieldCount = fields.length > 0 ? fields.length : 1
        const initial: Record<string, string[]> = {}
        data.members.forEach(m => { initial[m.player.id] = Array(fieldCount).fill('') })
        setScores(initial)
      })
      .catch(() => {})
  }, [leagueId])

  const isScoreBased = SCORE_BASED_TYPES.includes(winType)
  const isMissionBased = winType === 'secret-mission'

  async function handleSubmit() {
    let scoreEntries: { playerId: string; score: number }[]

    if (isScoreBased) {
      scoreEntries = members.map(m => ({
        playerId: m.player.id,
        score: (scores[m.player.id] ?? []).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0),
      }))
    } else {
      if (!winnerId) { toast.error(tErrors('required')); return }
      if (isMissionBased && !winningMission) { toast.error(tErrors('required')); return }
      scoreEntries = members.map(m => ({
        playerId: m.player.id,
        score: m.player.id === winnerId ? 1 : 0,
      }))
    }

    setLoading(true)
    const result = await logPlayedGame(leagueId, {
      playedAt: new Date(playedAt),
      notes,
      winningMission: isMissionBased ? winningMission : undefined,
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

        {/* Scores or Winner picker */}
        {isScoreBased ? (
          <div>
            <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('scores')}</label>
            <ul className="space-y-3">
              {members.map(m => (
                <li key={m.id} className="rounded-xl border p-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
                  <span className="block font-headline font-semibold text-sm mb-2" style={{ color: '#1c1810' }}>{m.player.name}</span>
                  {scoreFields.length > 0 ? (
                    <div className="space-y-1.5">
                      {scoreFields.map((field, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="flex-1 font-body text-xs" style={{ color: '#4a3f2f' }}>{field}</span>
                          <input
                            type="number"
                            value={scores[m.player.id]?.[i] ?? ''}
                            onChange={e => setScores(prev => {
                              const arr = [...(prev[m.player.id] ?? [])]
                              arr[i] = e.target.value
                              return { ...prev, [m.player.id]: arr }
                            })}
                            placeholder="0"
                            className="w-24 px-3 py-1.5 rounded-xl border font-headline font-bold text-sm text-right"
                            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
                            onFocus={e => (e.target.style.borderColor = '#f5a623')}
                            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={scores[m.player.id]?.[0] ?? ''}
                        onChange={e => setScores(prev => ({ ...prev, [m.player.id]: [e.target.value] }))}
                        placeholder={t('scorePlaceholder')}
                        className="w-full px-3 py-2 rounded-xl border font-headline font-bold text-sm text-right"
                        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
                        onFocus={e => (e.target.style.borderColor = '#f5a623')}
                        onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winner')}</label>
            <ul className="space-y-2">
              {members.map(m => {
                const selected = winnerId === m.player.id
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setWinnerId(m.player.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                      style={{
                        borderColor: selected ? '#f5a623' : '#e8e1d8',
                        background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                        color: '#1c1810',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#f5a623' : '#c4b79a' }}
                      >
                        {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623' }} />}
                      </span>
                      {m.player.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Mission picker — only for secret-mission win type */}
        {isMissionBased && missions.length > 0 && (
          <div>
            <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winningMission')}</label>
            <ul className="space-y-2">
              {missions.map(mission => {
                const selected = winningMission === mission
                return (
                  <li key={mission}>
                    <button
                      type="button"
                      onClick={() => setWinningMission(mission)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                      style={{
                        borderColor: selected ? '#f5a623' : '#e8e1d8',
                        background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                        color: '#1c1810',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#f5a623' : '#c4b79a' }}
                      >
                        {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623' }} />}
                      </span>
                      {mission}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

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
