'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { logPlayedGame, editPlayedGame } from '../actions'
import type { WinType } from '@/app/app/games/new/wizard-types'
import type { ResolverInput } from '@/lib/game-logic/types'
import { parseTimeInput } from '@/lib/game-logic/formatTime'

type Member = { id: string; player: { id: string; name: string; userId: string | null } }

type Template = {
  winType: WinType
  winCondition: 'high' | 'low' | null
  scoreFields: string[]
  roles: string[]
  missions: string[]
  minPlayers: number | null
  maxPlayers: number | null
  trackDifficulty: boolean
  trackTeamScores: boolean
  trackEliminationOrder: boolean
  timeUnit: 'seconds' | 'minutes' | 'mmss' | null
}

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
  const [template, setTemplate] = useState<Template | null>(null)
  const [step, setStep] = useState<'participants' | 'scores'>('participants')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [playedAt, setPlayedAt] = useState(defaultDatetime())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const [scoresByPlayerByField, setScoresByPlayer] = useState<Record<string, string[]>>({})
  const [winnerId, setWinnerId] = useState<string>('')
  const [winnerScore, setWinnerScore] = useState<string>('')
  const [winningMission, setWinningMission] = useState<string>('')
  const [timeByPlayer, setTimeByPlayer] = useState<Record<string, string | { mm: string; ss: string }>>({})
  const [rankByPlayer, setRankByPlayer] = useState<Record<string, string>>({})
  const [eliminationOrderByPlayer, setEliminationOrderByPlayer] = useState<Record<string, string>>({})
  const [roleByPlayer, setRoleByPlayer] = useState<Record<string, string>>({})
  const [coopWon, setCoopWon] = useState<boolean | null>(null)
  const [difficulty, setDifficulty] = useState<string>('')
  const [teamCount, setTeamCount] = useState<number>(2)
  const [teams, setTeams] = useState<string[]>(['Team 1', 'Team 2'])
  const [teamByPlayer, setTeamByPlayer] = useState<Record<string, string>>({})
  const [winningTeam, setWinningTeam] = useState<string>('')
  const [perTeamScores, setPerTeamScores] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/app/leagues/${leagueId}/members`)
      .then(r => r.json())
      .then((data: { members: Member[]; template: Template }) => {
        setMembers(data.members)
        setTemplate(data.template)
        const initial: Record<string, string[]> = {}
        const fields = data.template.scoreFields.length > 0 ? data.template.scoreFields : ['']
        data.members.forEach(m => { initial[m.player.id] = Array(fields.length).fill('') })
        setScoresByPlayer(initial)
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
        difficulty: string
        teams: string[]
        teamScores: { name: string; score: number }[] | null
        participantIds: string[]
        winnerId: string
        scores: {
          playerId: string; score: number; isWinner: boolean
          role: string | null; team: string | null; rank: number | null; eliminationOrder: number | null
        }[]
      } | null) => {
        if (!data) return
        setPlayedAt(data.playedAt)
        setNotes(data.notes)
        setWinningMission(data.winningMission)
        setDifficulty(data.difficulty)
        setSelectedIds(new Set(data.participantIds))
        setWinnerId(data.winnerId)
        const winnerEntry = data.scores.find(s => s.playerId === data.winnerId)
        if (winnerEntry) setWinnerScore(String(winnerEntry.score))

        const timeMap: Record<string, string | { mm: string; ss: string }> = {}
        const rankMap: Record<string, string> = {}
        const elimMap: Record<string, string> = {}
        const roleMap: Record<string, string> = {}
        const teamMap: Record<string, string> = {}
        for (const s of data.scores) {
          timeMap[s.playerId] = String(s.score)
          if (s.rank !== null) rankMap[s.playerId] = String(s.rank)
          if (s.eliminationOrder !== null) elimMap[s.playerId] = String(s.eliminationOrder)
          if (s.role) roleMap[s.playerId] = s.role
          if (s.team) teamMap[s.playerId] = s.team
        }
        setTimeByPlayer(timeMap)
        setRankByPlayer(rankMap)
        setEliminationOrderByPlayer(elimMap)
        setRoleByPlayer(roleMap)
        setTeamByPlayer(teamMap)
        if (data.teams.length > 0) {
          setTeams(data.teams)
          setTeamCount(data.teams.length)
        }
        if (data.teamScores) {
          setPerTeamScores(Object.fromEntries(data.teamScores.map(ts => [ts.name, String(ts.score)])))
        }
        if (data.scores.length > 0) setCoopWon(data.scores[0].isWinner)
        const winSe = data.scores.find(s => s.isWinner && s.team)
        if (winSe) setWinningTeam(winSe.team!)

        setScoresByPlayer(prev => {
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

  if (!template) {
    return <div className="max-w-lg mx-auto py-8 px-2"><p className="font-body text-sm">Loading…</p></div>
  }

  const winType = template.winType
  const selectedCount = selectedIds.size
  const participants = members.filter(m => selectedIds.has(m.player.id))

  const playerCountError = (() => {
    if (template.minPlayers !== null && selectedCount < template.minPlayers) return t('minPlayersNote', { min: template.minPlayers })
    if (template.maxPlayers !== null && selectedCount > template.maxPlayers) return t('maxPlayersNote', { max: template.maxPlayers })
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

  function buildResolverInput(): ResolverInput | { error: string } {
    const participantIds = participants.map(p => p.player.id)
    switch (winType) {
      case 'points-all': {
        const perPlayerScores: Record<string, number> = {}
        for (const pid of participantIds) {
          const arr = scoresByPlayerByField[pid] ?? []
          perPlayerScores[pid] = arr.reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
        }
        return { participantIds, perPlayerScores }
      }
      case 'points-winner':
        if (!winnerId) return { error: 'required' }
        return { participantIds, winnerId, winnerScore: parseInt(winnerScore, 10) || 0 }
      case 'time': {
        const perPlayerTimeSeconds: Record<string, number> = {}
        for (const pid of participantIds) {
          const raw = timeByPlayer[pid]
          if (raw === undefined) return { error: 'required' }
          const parsed = parseTimeInput(raw, template!.timeUnit)
          if (parsed === null) return { error: 'required' }
          perPlayerTimeSeconds[pid] = parsed
        }
        return { participantIds, perPlayerTimeSeconds }
      }
      case 'ranking': {
        const perPlayerRank: Record<string, number> = {}
        for (const pid of participantIds) {
          const r = parseInt(rankByPlayer[pid] ?? '', 10)
          if (!Number.isFinite(r)) return { error: 'required' }
          perPlayerRank[pid] = r
        }
        return { participantIds, perPlayerRank }
      }
      case 'elimination': {
        if (!template!.trackEliminationOrder) {
          if (!winnerId) return { error: 'required' }
          return { participantIds, winnerId }
        }
        const perPlayerEliminationOrder: Record<string, number | null> = {}
        for (const pid of participantIds) {
          const raw = eliminationOrderByPlayer[pid]
          if (raw === undefined || raw.trim() === '') perPlayerEliminationOrder[pid] = null
          else {
            const n = parseInt(raw, 10)
            if (!Number.isFinite(n)) return { error: 'required' }
            perPlayerEliminationOrder[pid] = n
          }
        }
        return { participantIds, perPlayerEliminationOrder }
      }
      case 'winner': {
        if (!winnerId) return { error: 'required' }
        const perPlayerRole: Record<string, string | null> = {}
        if (template!.roles.length > 0) {
          for (const pid of participantIds) perPlayerRole[pid] = roleByPlayer[pid] || null
        }
        return { participantIds, winnerId, perPlayerRole }
      }
      case 'cooperative': {
        if (coopWon === null) return { error: 'required' }
        return { participantIds, cooperativeWon: coopWon, difficulty }
      }
      case 'team': {
        if (!winningTeam) return { error: 'required' }
        for (const pid of participantIds) if (!teamByPlayer[pid]) return { error: 'required' }
        const perTeamScoresNum: Record<string, number> = {}
        if (template!.trackTeamScores) {
          for (const name of teams) perTeamScoresNum[name] = parseInt(perTeamScores[name] ?? '', 10) || 0
        }
        return {
          participantIds,
          teams,
          teamAssignments: Object.fromEntries(participantIds.map(p => [p, teamByPlayer[p]])),
          winningTeam,
          perTeamScores: template!.trackTeamScores ? perTeamScoresNum : undefined,
        }
      }
      case 'secret-mission': {
        if (!winnerId) return { error: 'required' }
        if (!winningMission) return { error: 'required' }
        return { participantIds, winnerId, winningMission }
      }
    }
  }

  async function handleSubmit() {
    const resolverOrErr = buildResolverInput()
    if ('error' in resolverOrErr) { toast.error(tErrors(resolverOrErr.error as never)); return }

    setLoading(true)
    const result = editId
      ? await editPlayedGame(editId, leagueId, { playedAt: new Date(playedAt), notes, resolverInput: resolverOrErr })
      : await logPlayedGame(leagueId, { playedAt: new Date(playedAt), notes, resolverInput: resolverOrErr })
    setLoading(false)

    if (!result.success) { toast.error(tErrors(result.error as never)); return }
    toast.success(editId ? tToasts('sessionUpdated') : tToasts('gameSaved'))
    router.push(`/app/leagues/${leagueId}`)
  }

  if (step === 'participants') {
    return (
      <ParticipantStep
        t={t}
        members={members}
        selectedIds={selectedIds}
        toggleParticipant={toggleParticipant}
        selectedCount={selectedCount}
        playerCountError={playerCountError}
        minPlayers={template.minPlayers}
        maxPlayers={template.maxPlayers}
        editId={editId}
        onContinue={() => setStep('scores')}
      />
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
        <DateTimeField value={playedAt} onChange={setPlayedAt} label={t('playedAt')} />

        {winType === 'points-all' && (
          <ScoreGrid
            label={t('scores')}
            participants={participants}
            scoreFields={template.scoreFields}
            scores={scoresByPlayerByField}
            onChange={setScoresByPlayer}
            scorePlaceholder={t('scorePlaceholder')}
          />
        )}

        {(winType === 'points-winner' || winType === 'winner' || winType === 'secret-mission' || (winType === 'elimination' && !template.trackEliminationOrder)) && (
          <WinnerRadio label={t('winner')} participants={participants} winnerId={winnerId} onChange={setWinnerId} />
        )}

        {winType === 'points-winner' && winnerId && (
          <NumberField label={t('winnerScore')} value={winnerScore} onChange={setWinnerScore} placeholder={t('scorePlaceholder')} />
        )}

        {winType === 'time' && (
          <TimeInputs
            label={t('scores')}
            participants={participants}
            unit={template.timeUnit}
            values={timeByPlayer}
            onChange={setTimeByPlayer}
          />
        )}

        {winType === 'ranking' && (
          <RankingInputs label={t('rankings')} participants={participants} values={rankByPlayer} onChange={setRankByPlayer} />
        )}

        {winType === 'elimination' && template.trackEliminationOrder && (
          <EliminationOrderInputs
            label={t('eliminationOrder')}
            participants={participants}
            values={eliminationOrderByPlayer}
            onChange={setEliminationOrderByPlayer}
          />
        )}

        {winType === 'winner' && template.roles.length > 0 && participants.length > 0 && (
          <RoleDropdowns
            label={t('roles')}
            participants={participants}
            roles={template.roles}
            values={roleByPlayer}
            onChange={setRoleByPlayer}
          />
        )}

        {winType === 'cooperative' && (
          <CooperativeResult
            label={t('coopResult')}
            won={coopWon}
            onChange={setCoopWon}
            wonLabel={t('coopWon')}
            lostLabel={t('coopLost')}
          />
        )}
        {winType === 'cooperative' && template.trackDifficulty && (
          <TextField label={t('difficulty')} value={difficulty} onChange={setDifficulty} placeholder={t('difficultyPlaceholder')} />
        )}

        {winType === 'team' && (
          <TeamSetup
            participants={participants}
            teamCount={teamCount}
            teams={teams}
            teamByPlayer={teamByPlayer}
            winningTeam={winningTeam}
            perTeamScores={perTeamScores}
            trackTeamScores={template.trackTeamScores}
            onTeamCountChange={n => {
              setTeamCount(n)
              setTeams(prev => {
                const next = [...prev]
                while (next.length < n) next.push(`Team ${next.length + 1}`)
                next.length = n
                return next
              })
            }}
            onTeamsChange={setTeams}
            onTeamByPlayerChange={setTeamByPlayer}
            onWinningTeamChange={setWinningTeam}
            onPerTeamScoresChange={setPerTeamScores}
            t={t}
          />
        )}

        {winType === 'secret-mission' && template.missions.length > 0 && (
          <MissionDropdown
            label={t('winningMission')}
            missions={template.missions}
            value={winningMission}
            onChange={setWinningMission}
          />
        )}

        <TextArea label={t('notes')} value={notes} onChange={setNotes} />

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

function ParticipantStep({
  t, members, selectedIds, toggleParticipant, selectedCount,
  playerCountError, minPlayers, maxPlayers, editId, onContinue,
}: {
  t: ReturnType<typeof useTranslations>
  members: Member[]
  selectedIds: Set<string>
  toggleParticipant: (id: string) => void
  selectedCount: number
  playerCountError: string | null
  minPlayers: number | null
  maxPlayers: number | null
  editId: string | null
  onContinue: () => void
}) {
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
        onClick={onContinue}
        disabled={selectedCount === 0 || !!playerCountError}
        className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-40"
        style={{ background: '#f5a623', color: '#1c1408' }}
      >
        {t('continue')}
      </button>
    </div>
  )
}

function DateTimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{label}</label>
      <input
        type="datetime-local"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm"
        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
      />
    </div>
  )
}

function TextArea({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
      />
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm"
        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
      />
    </div>
  )
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border font-headline font-bold text-sm text-right"
        style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
      />
    </div>
  )
}

function ScoreGrid({ label, participants, scoreFields, scores, onChange, scorePlaceholder }: {
  label: string
  participants: Member[]
  scoreFields: string[]
  scores: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  scorePlaceholder: string
}) {
  const fields = scoreFields.length > 0 ? scoreFields : ['']
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-3">
        {participants.map(m => (
          <li key={m.id} className="rounded-xl border p-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
            <span className="block font-headline font-semibold text-sm mb-2" style={{ color: '#1c1810' }}>{m.player.name}</span>
            {fields.length > 1 ? (
              <div className="space-y-1.5">
                {fields.map((field, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 font-body text-xs" style={{ color: '#4a3f2f' }}>{field}</span>
                    <input
                      type="number"
                      value={scores[m.player.id]?.[i] ?? ''}
                      onChange={e => {
                        const arr = [...(scores[m.player.id] ?? [])]
                        arr[i] = e.target.value
                        onChange({ ...scores, [m.player.id]: arr })
                      }}
                      placeholder="0"
                      className="w-24 px-3 py-1.5 rounded-xl border font-headline font-bold text-sm text-right"
                      style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <input
                type="number"
                value={scores[m.player.id]?.[0] ?? ''}
                onChange={e => onChange({ ...scores, [m.player.id]: [e.target.value] })}
                placeholder={scorePlaceholder}
                className="w-full px-3 py-2 rounded-xl border font-headline font-bold text-sm text-right"
                style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function WinnerRadio({ label, participants, winnerId, onChange }: {
  label: string; participants: Member[]; winnerId: string; onChange: (id: string) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {participants.map(m => {
          const selected = winnerId === m.player.id
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onChange(m.player.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                style={{
                  borderColor: selected ? '#f5a623' : '#e8e1d8',
                  background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                  color: '#1c1810',
                }}
              >
                <span className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: selected ? '#f5a623' : '#c4b79a' }}>
                  {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623' }} />}
                </span>
                {m.player.name}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TimeInputs({ label, participants, unit, values, onChange }: {
  label: string; participants: Member[]; unit: 'seconds' | 'minutes' | 'mmss' | null
  values: Record<string, string | { mm: string; ss: string }>
  onChange: (next: Record<string, string | { mm: string; ss: string }>) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-3">
        {participants.map(m => {
          const v = values[m.player.id]
          return (
            <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
              <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
              {unit === 'mmss' ? (
                <>
                  <input type="number" placeholder="MM"
                    value={(typeof v === 'object' ? v.mm : '') as string}
                    onChange={e => onChange({ ...values, [m.player.id]: { mm: e.target.value, ss: typeof v === 'object' ? v.ss : '' } })}
                    className="w-14 px-2 py-1.5 rounded-xl border text-right" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }} />
                  <span style={{ color: '#9a8878' }}>:</span>
                  <input type="number" placeholder="SS"
                    value={(typeof v === 'object' ? v.ss : '') as string}
                    onChange={e => onChange({ ...values, [m.player.id]: { mm: typeof v === 'object' ? v.mm : '', ss: e.target.value } })}
                    className="w-14 px-2 py-1.5 rounded-xl border text-right" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }} />
                </>
              ) : (
                <input
                  type="number"
                  step={unit === 'minutes' ? '0.1' : '1'}
                  placeholder={unit === 'minutes' ? 'min' : 'sec'}
                  value={typeof v === 'string' ? v : ''}
                  onChange={e => onChange({ ...values, [m.player.id]: e.target.value })}
                  className="w-24 px-3 py-1.5 rounded-xl border text-right" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RankingInputs({ label, participants, values, onChange }: {
  label: string; participants: Member[]; values: Record<string, string>; onChange: (next: Record<string, string>) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {participants.map(m => (
          <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
            <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
            <input
              type="number" min={1} max={participants.length} placeholder="#"
              value={values[m.player.id] ?? ''}
              onChange={e => onChange({ ...values, [m.player.id]: e.target.value })}
              className="w-16 px-3 py-1.5 rounded-xl border text-right font-headline font-bold text-sm"
              style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function EliminationOrderInputs({ label, participants, values, onChange }: {
  label: string; participants: Member[]; values: Record<string, string>; onChange: (next: Record<string, string>) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {participants.map(m => (
          <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
            <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
            <input
              type="number" min={1} placeholder="—"
              value={values[m.player.id] ?? ''}
              onChange={e => onChange({ ...values, [m.player.id]: e.target.value })}
              className="w-16 px-3 py-1.5 rounded-xl border text-right font-headline font-bold text-sm"
              style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoleDropdowns({ label, participants, roles, values, onChange }: {
  label: string; participants: Member[]; roles: string[]; values: Record<string, string>; onChange: (next: Record<string, string>) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {participants.map(m => (
          <li key={m.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
            <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
            <select
              value={values[m.player.id] ?? ''}
              onChange={e => onChange({ ...values, [m.player.id]: e.target.value })}
              className="px-3 py-1.5 rounded-xl border font-body text-sm" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
            >
              <option value="">—</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CooperativeResult({ label, won, onChange, wonLabel, lostLabel }: {
  label: string; won: boolean | null; onChange: (v: boolean) => void; wonLabel: string; lostLabel: string
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <div className="flex gap-2">
        {[{ v: true, l: wonLabel }, { v: false, l: lostLabel }].map(opt => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => onChange(opt.v)}
            className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{
              background: won === opt.v ? '#f5a623' : '#f0ebe3',
              color: won === opt.v ? '#1c1408' : '#4a3f2f',
            }}
          >
            {opt.l}
          </button>
        ))}
      </div>
    </div>
  )
}

function MissionDropdown({ label, missions, value, onChange }: {
  label: string; missions: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{label}</label>
      <ul className="space-y-2">
        {missions.map(m => {
          const selected = value === m
          return (
            <li key={m}>
              <button
                type="button"
                onClick={() => onChange(m)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left"
                style={{
                  borderColor: selected ? '#f5a623' : '#e8e1d8',
                  background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                  color: '#1c1810',
                }}
              >
                <span className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: selected ? '#f5a623' : '#c4b79a' }}>
                  {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623' }} />}
                </span>
                {m}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TeamSetup(props: {
  participants: Member[]
  teamCount: number
  teams: string[]
  teamByPlayer: Record<string, string>
  winningTeam: string
  perTeamScores: Record<string, string>
  trackTeamScores: boolean
  onTeamCountChange: (n: number) => void
  onTeamsChange: (teams: string[]) => void
  onTeamByPlayerChange: (map: Record<string, string>) => void
  onWinningTeamChange: (team: string) => void
  onPerTeamScoresChange: (map: Record<string, string>) => void
  t: ReturnType<typeof useTranslations>
}) {
  const { participants, teamCount, teams, teamByPlayer, winningTeam, perTeamScores, trackTeamScores, t } = props
  const maxTeams = Math.max(2, Math.floor(participants.length / 2))
  return (
    <div className="space-y-4">
      <div>
        <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('teamCount')}</label>
        <input
          type="number" min={2} max={maxTeams} value={teamCount}
          onChange={e => {
            const n = Math.max(2, Math.min(maxTeams, parseInt(e.target.value, 10) || 2))
            props.onTeamCountChange(n)
          }}
          className="w-24 px-3 py-1.5 rounded-xl border text-right font-headline font-bold text-sm"
          style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
        />
      </div>
      <div>
        <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('teamNames')}</label>
        <div className="space-y-2">
          {teams.map((tn, i) => (
            <input
              key={i}
              value={tn}
              onChange={e => {
                const next = [...teams]
                next[i] = e.target.value
                props.onTeamsChange(next)
              }}
              className="w-full px-3 py-2 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('teamAssignment')}</label>
        <ul className="space-y-2">
          {participants.map(m => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
              <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{m.player.name}</span>
              <select
                value={teamByPlayer[m.player.id] ?? ''}
                onChange={e => props.onTeamByPlayerChange({ ...teamByPlayer, [m.player.id]: e.target.value })}
                className="px-3 py-1.5 rounded-xl border font-body text-sm" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
              >
                <option value="">—</option>
                {teams.map(tn => <option key={tn} value={tn}>{tn}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winningTeam')}</label>
        <div className="flex flex-wrap gap-2">
          {teams.map(tn => {
            const selected = winningTeam === tn
            return (
              <button
                key={tn} type="button"
                onClick={() => props.onWinningTeamChange(tn)}
                className="px-4 py-2 rounded-xl border font-headline font-bold text-sm"
                style={{
                  borderColor: selected ? '#f5a623' : '#e8e1d8',
                  background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                  color: '#1c1810',
                }}
              >{tn}</button>
            )
          })}
        </div>
      </div>
      {trackTeamScores && (
        <div>
          <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('teamScores')}</label>
          <ul className="space-y-2">
            {teams.map(tn => (
              <li key={tn} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
                <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{tn}</span>
                <input
                  type="number"
                  value={perTeamScores[tn] ?? ''}
                  onChange={e => props.onPerTeamScoresChange({ ...perTeamScores, [tn]: e.target.value })}
                  className="w-24 px-3 py-1.5 rounded-xl border text-right font-headline font-bold text-sm"
                  style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
