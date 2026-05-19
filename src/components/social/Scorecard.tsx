'use client'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { ALLOWED_REACTIONS } from '@/lib/reactions'
import { toggleReaction } from '@/app/app/social/actions'
import type { FeedGame, FeedReaction } from '@/lib/social/loadFeed'

type Props = {
  game: FeedGame
  canReact: boolean
  locale: 'nl' | 'en'
}

export function Scorecard({ game, canReact, locale }: Props) {
  const [reactions, setReactions] = useState<FeedReaction[]>(game.reactions)
  const [, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'

  function onToggle(emoji: string) {
    if (!canReact) return
    // Optimistic
    const prev = reactions
    const idx = prev.findIndex(r => r.emoji === emoji)
    const next: FeedReaction[] = idx === -1
      ? [...prev, { emoji, count: 1, mine: true }]
      : prev[idx]!.mine
        ? prev.flatMap(r => r.emoji === emoji ? (r.count === 1 ? [] : [{ ...r, count: r.count - 1, mine: false }]) : [r])
        : prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)
    setReactions(next)
    setPopoverOpen(false)
    startTransition(async () => {
      const result = await toggleReaction(game.id, emoji)
      if ('reactions' in result) setReactions(result.reactions)
      else setReactions(prev) // revert on error
    })
  }

  const winner = game.scores.find(s => s.isWinner)
  const others = game.scores.filter(s => !s.isWinner)
  const playedDate = new Date(game.playedAt)
  const timeAgo = playedDate.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })

  return (
    <article
      id={`game-${game.id}`}
      style={{
        background: '#fefcf8',
        border: '1px solid rgba(245,166,35,0.08)',
        boxShadow: '0 2px 16px rgba(30,26,20,0.07)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* tear-line */}
      <div
        aria-hidden
        style={{
          height: 8,
          background: 'repeating-linear-gradient(to right, rgba(245,166,35,0.35) 0 3px, transparent 3px 9px)',
        }}
      />

      <div style={{ padding: '14px 16px 12px' }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            style={{
              width: 28, height: 28, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${game.gameTemplate.color}2e`, fontSize: 16,
            }}
          >
            {game.gameTemplate.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 13, color: '#1e1a14' }}>
              {game.gameTemplate.name}
            </div>
            <div style={{ fontSize: 11, color: '#9a8c7a' }}>{game.league.name}</div>
          </div>
          <span style={{ fontSize: 11, color: '#9a8c7a' }}>{timeAgo}</span>
        </div>

        {/* Score block */}
        <ul className="space-y-1 mb-3">
          {winner && (
            <li
              key={winner.id}
              style={{ fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 18, color: '#f5a623' }}
            >
              {winner.playerName} <span style={{ fontSize: 14, fontWeight: 700 }}>{winner.score}</span>
            </li>
          )}
          {others.map(s => (
            <li key={s.id} style={{ fontSize: 13, color: '#1e1a14' }}>
              {s.playerName} <span style={{ color: '#6b5e4a' }}>{s.score}</span>
            </li>
          ))}
        </ul>

        {/* Reactions strip */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {reactions.map(r => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onToggle(r.emoji)}
              disabled={!canReact}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 999,
                background: r.mine ? '#fff3d4' : '#f7f2e8',
                border: r.mine ? '1px solid #f5a623' : '1px solid transparent',
                fontSize: 13, color: '#1e1a14', cursor: canReact ? 'pointer' : 'default',
                opacity: r.count > 0 ? 1 : 0.3,
              }}
            >
              <span>{r.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{r.count}</span>
            </button>
          ))}
          {canReact && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPopoverOpen(o => !o)}
                aria-label="React"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 999,
                  background: 'transparent', border: '1px dashed #c5b89f',
                  fontSize: 12, color: '#6b5e4a', cursor: 'pointer',
                }}
              >
                <Plus size={12} />
              </button>
              {popoverOpen && (
                <div
                  role="dialog"
                  style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
                    display: 'flex', gap: 6, padding: 8,
                    background: '#fefcf8', border: '1px solid #c5b89f',
                    borderRadius: 12, boxShadow: '0 8px 24px -8px rgba(60,40,15,0.2)',
                    zIndex: 20,
                  }}
                >
                  {ALLOWED_REACTIONS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => onToggle(e)}
                      style={{ fontSize: 20, background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
