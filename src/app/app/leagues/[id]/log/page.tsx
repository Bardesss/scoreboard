'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { logPlayedGame, editPlayedGame } from '../actions'
import type { WinType } from '@/app/app/games/new/wizard-types'

type Member = { id: string; player: { id: string; name: string } }

const SCORE_BASED_TYPES: WinType[] = ['points-all', 'points-winner', 'time', 'ranking']

function defaultDatetime(): string {
  const ms = 5 * 60 * 1000
  const now = new Date(Math.round(Date.now() / ms) * ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export default function LogGamePage() {
  const t = useTranslations('app.playedGames')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const router = useRouter()
  const { id: leagueId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [members, setMembers] = useState<Member[]>([])
  const [winType, setWinType] = useState<WinType>('points-all')
  const [missions, setMissions] = useState<string[]>([])
  const [scoreFields, setScoreFields] = useState<string[]>([])
  const [minPlayers, setMinPlayers] = useState<number | null>(null)
  const [maxPlayers, setMaxPlayers] = useState<number | null>(null)
  const [step, setStep] = useState<'participants' | 'scores'>('participants')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [playedAt, setPlayedAt] = useState(defaultDatetime())
  const [notes, setNotes] = useState('')
  const [scores, setScores] = useState<Record<string, string[]>>({})
  const [winnerId, setWinnerId] = useState<string>('')
  const [winningMission, setWinningMission] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/app/leagues/${leagueId}/members`)
      .then(r => r.json())
      .then((data: {
        members: Member[]
        winType: WinType
        missions: string[]
        scoreFields: string[]
        minPlayers: number | null
        maxPlayers: number | null
      }) => {
        setMembers(data.members)
        setWinType(data.winType)
        setMissions(data.missions ?? [])
        const fields = data.scoreFields ?? []
        setScoreFields(fields)
        setMinPlayers(data.minPlayers ?? null)
        setMaxPlayers(data.maxPlayers ?? null)
        const fieldCount = fields.length > 0 ? fields.length : 1
        const initial: Record<string, string[]> = {}
        data.members.forEach(m => { initial[m.player.id] = Array(fieldCount).fill('') })
        setScores(initial)
      })
      .catch(() => {})
  }, [leagueId])

  useEffect(() => {
    if (!editId) return
    fetch(`/api/app/leagues/${leagueId}/sessions/${editId}`)
      .then(r => r.json())
      .then((data: {
        playedAt: string
        notes: string
        winningMission: string
        participantIds: string[]
        scores: { playerId: string; score: number }[]
        winnerId: string
      }) => {
        if (!data) return
        setPlayedAt(data.playedAt)
        setNotes(data.notes)
        setWinningMission(data.winningMission)
        setSelectedIds(new Set(data.participantIds))
        setWinnerId(data.winnerId)
        setScores(prev => {
          const merged: Record<string, string[]> = { ...prev }
          data.scores.forEach(s => {
            if (merged[s.playerId]) {
              merged[s.playerId] = merged[s.playerId].map((_, i) => (i === 0 ? String(s.score) : ''))
            } else {
              merged[s.playerId] = [String(s.score)]
            }
          })
          return merged
        })
      })
      .catch(() => {})
  }, [editId, leagueId])

  const isScoreBased = SCORE_BASED_TYPES.includes(winType)
  const isMissionBased = winType === 'secret-mission'
  const selectedCount = selectedIds.size
  const participants = members.filter(m => selectedIds.has(m.player.id))

  const playerCountError = (() => {
    if (minPlayers !== null && selectedCount < minPlayers) return t('minPlayersNote', { min: minPlayers })
    if (maxPlayers !== null && selectedCount > maxPlayers) return t('maxPlayersNote', { max: maxPlayers })
    return null
  })()

  function toggleParticipant(playerId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  async function handleSubmit() {
    let scoreEntries: { playerId: string; score: number }[]

    if (isScoreBased) {
      scoreEntries = participants.map(m => ({
        playerId: m.player.id,
        score: (scores[m.player.id] ?? []).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0),
      }))
    } else {
      if (!winnerId) { toast.error(tErrors('required')); return }
      if (isMissionBased && !winningMission) { toast.error(tErrors('required')); return }
      scoreEntries = participants.map(m => ({
        playerId: m.player.id,
        score: m.player.id === winnerId ? 1 : 0,
      }))
    }

    setLoading(true)

    if (editId) {
      const result = await editPlayedGame(editId, leagueId, {
        playedAt: new Date(playedAt),
        notes,
        winningMission: isMissionBased ? winningMission : undefined,
        scores: scoreEntries,
      })
      setLoading(false)
      if (!result.success) { toast.error(tErrors(result.error as never)); return }
      toast.success(tToasts('sessionUpdated'))
    } else {
      const result = await logPlayedGame(leagueId, {
        playedAt: new Date(playedAt),
        notes,
        winningMission: isMissionBased ? winningMission : undefined,
        scores: scoreEntries,
      })
      setLoading(false)
      if (!result.success) { toast.error(tErrors(result.error as never)); return }
      toast.success(tToasts('gameSaved'))
    }

    router.push(`/app/leagues/${leagueId}`)
  }

  if (step === 'participants') {
    return (
      <div className="max-w-lg mx-auto py-8 px-2">
        <h1 className="font-headline font-black text-2xl mb-6" style={{ color: '#1c1810' }}>
          {editId ? t('edit') : t('log')}
        </h1>

        <div className="space-y-4 p-6 rounded-2xl mb-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-headline font-semibold text-xs" style={{ color: '#4a3f2f' }}>
                {t('selectParticipants')}
              </label>
              <span className="font-headline font-bold text-xs" style={{ color: '#9a8878' }}>
                {t('playersSelected', { count: selectedCount })}
                {(minPlayers !== null || maxPlayers !== null) && (
                  <span className="ml-2" style={{ color: '#c4b79a' }}>
                    ({t('playerHint', { min: minPlayers ?? '?', max: maxPlayers ?? '?' })})
                  </span>
                )}
              </span>
            </div>
            <ul className="space-y-2">
              {members.map(m => {
                const selected = selectedIds.has(m.player.id)
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggleParticipant(m.player.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                      style={{
                        borderColor: selected ? '#f5a623' : '#e8e1d8',
                        background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                        color: '#1c1810',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#f5a623' : '#c4b79a', background: selected ? '#f5a623' : 'transparent' }}
                      >
                        {selected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {m.player.name}
                    </button>
                  </li>
                )
              })}
            </ul>
            {playerCountError && (
              <p className="mt-3 text-xs font-body" style={{ color: '#c47f00' }}>{playerCountError}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => setStep('scores')}
          disabled={selectedCount === 0 || !!playerCountError}
          className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-40"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          {t('continue')}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setStep('participants')}
          className="font-headline font-semibold text-sm"
          style={{ color: '#f5a623' }}
        >
          {t('back')}
        </button>
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>
          {editId ? t('edit') : t('log')}
        </h1>
      </div>

      <div className="space-y-4 p-6 rounded-2xl mb-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <div>
          <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{t('playedAt')}</label>
          <input
            type="datetime-local"
            value={playedAt}
            onChange={e => setPlayedAt(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        </div>

        {isScoreBased ? (
          <div>
            <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('scores')}</label>
            <ul className="space-y-3">
              {participants.map(m => (
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
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winner')}</label>
            <ul className="space-y-2">
              {participants.map(m => {
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

        {!editId && (
          <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
            {t('cost')}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
        style={{ background: '#f5a623', color: '#1c1408' }}
      >
        {loading ? t('saving') : editId ? t('saveChanges') : t('submit')}
      </button>
    </div>
  )
}
