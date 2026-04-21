'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { adminApproveGame, adminRejectGame } from './actions'

interface Score {
  id: string
  playerName: string
  score: number
}

interface Game {
  id: string
  league: { id: string; name: string }
  submittedBy: { email: string; username: string | null }
  playedAt: string
  notes: string | null
  scores: Score[]
}

interface Props {
  games: Game[]
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export default function ApprovalsClient({ games: initialGames }: Props) {
  const [games, setGames] = useState<Game[]>(initialGames)
  const [isPending, startTransition] = useTransition()

  function handleApprove(gameId: string) {
    startTransition(async () => {
      const result = await adminApproveGame(gameId)
      if (result.success) {
        toast.success('Partij goedgekeurd')
        setGames(prev => prev.filter(g => g.id !== gameId))
      } else {
        toast.error('Goedkeuren mislukt')
      }
    })
  }

  function handleReject(gameId: string) {
    startTransition(async () => {
      const result = await adminRejectGame(gameId)
      if (result.success) {
        toast.success('Partij afgewezen')
        setGames(prev => prev.filter(g => g.id !== gameId))
      } else {
        toast.error('Afwijzen mislukt')
      }
    })
  }

  const cardStyle: React.CSSProperties = {
    background: '#161f28',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  }

  const buttonStyle = (variant: 'success' | 'danger'): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      border: 'none',
      borderRadius: 10,
      padding: '8px 16px',
      fontSize: 13.5,
      fontWeight: 600,
      cursor: isPending ? 'not-allowed' : 'pointer',
      opacity: isPending ? 0.7 : 1,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }

    if (variant === 'success') {
      return {
        ...baseStyle,
        background: '#22c55e',
        color: '#fff',
      }
    } else {
      return {
        ...baseStyle,
        background: '#ef4444',
        color: '#fff',
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <h1
          className="font-headline"
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.87)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Goedkeuringen
        </h1>
        <span
          style={{
            background: 'rgba(74,142,255,0.12)',
            border: '1px solid rgba(74,142,255,0.25)',
            color: '#4a8eff',
            borderRadius: 20,
            padding: '2px 10px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {games.length}
        </span>
      </div>

      {/* Empty state */}
      {games.length === 0 && (
        <div
          style={{
            background: '#161f28',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 48,
            textAlign: 'center',
          }}
        >
          <CheckCircle2 size={32} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
            Geen partijen wachten op goedkeuring
          </p>
        </div>
      )}

      {/* Games list */}
      {games.length > 0 && (
        <div>
          {games.map(game => (
            <div key={game.id} style={cardStyle}>
              {/* Header: League and submitter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.87)',
                      margin: '0 0 4px',
                    }}
                  >
                    {game.league.name}
                  </h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                    {game.submittedBy.username ? `${game.submittedBy.username} (${game.submittedBy.email})` : game.submittedBy.email}
                  </p>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  {formatDate(game.playedAt)}
                </span>
              </div>

              {/* Scores */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8, fontWeight: 600 }}>
                  SCORES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {game.scores.map(score => (
                    <div key={score.id} style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                      {score.playerName}: <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.87)' }}>{score.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {game.notes && (
                <div style={{ marginBottom: 16, padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontWeight: 600 }}>
                    NOTITIES
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0, wordBreak: 'break-word' }}>
                    {game.notes}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleApprove(game.id)}
                  disabled={isPending}
                  style={buttonStyle('success')}
                >
                  Goedkeuren
                </button>
                <button
                  onClick={() => handleReject(game.id)}
                  disabled={isPending}
                  style={buttonStyle('danger')}
                >
                  <Trash2 size={14} />
                  Afwijzen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
