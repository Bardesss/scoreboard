'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { approvePlayedGame, rejectPlayedGame } from './actions'

type PendingGame = {
  id: string
  playedAt: string
  submittedByEmail: string
  scores: { playerName: string; score: number }[]
}

export function PendingApprovalSection({ games }: { games: PendingGame[] }) {
  const [list, setList] = useState(games)

  async function handleApprove(id: string) {
    const res = await approvePlayedGame(id)
    if ('error' in res) { toast.error('Failed'); return }
    toast.success('Game approved')
    setList(l => l.filter(g => g.id !== id))
  }

  async function handleReject(id: string) {
    const res = await rejectPlayedGame(id)
    if ('error' in res) { toast.error('Failed'); return }
    toast.success('Game rejected')
    setList(l => l.filter(g => g.id !== id))
  }

  if (list.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#e85c0d' }}>
        Pending approval ({list.length})
      </h2>
      <ul className="space-y-3">
        {list.map(pg => (
          <li key={pg.id} className="p-4 rounded-2xl" style={{ background: '#fff8f5', border: '1px solid #f5c6a0' }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-body text-xs" style={{ color: '#9a8878' }}>
                  Submitted by {pg.submittedByEmail} · {new Date(pg.playedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReject(pg.id)} className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  <X size={14} />
                </button>
                <button onClick={() => handleApprove(pg.id)} className="p-1.5 rounded-lg" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <Check size={14} />
                </button>
              </div>
            </div>
            <ul className="space-y-0.5">
              {pg.scores.map((s, i) => (
                <li key={i} className="flex justify-between text-xs font-body">
                  <span style={{ color: i === 0 ? '#f5a623' : '#4a3f2f' }}>{s.playerName}</span>
                  <span style={{ color: '#9a8878' }}>{s.score}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
