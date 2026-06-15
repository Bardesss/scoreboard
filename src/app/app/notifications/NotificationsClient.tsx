'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Bell, Trash2, UserPlus, CheckCircle2, XCircle, Trophy, Inbox, Dices, Sparkles } from 'lucide-react'
import { markNotificationRead, deleteNotification } from './actions'

type Notification = {
  id: string
  type: string
  meta: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

function hrefFor(n: Notification): string {
  const meta = n.meta ?? {}
  const leagueId = typeof meta.leagueId === 'string' ? meta.leagueId : null
  switch (n.type) {
    case 'connection_request':
    case 'connection_accepted':
    case 'connection_declined':
      return '/app/players'
    case 'league_invite':
    case 'played_game_accepted':
    case 'played_game_rejected':
      return leagueId ? `/app/leagues/${leagueId}` : '/app/leagues'
    case 'connection_game_logged':
    case 'reaction_received': {
      const playedGameId = typeof meta.playedGameId === 'string' ? meta.playedGameId : null
      return playedGameId ? `/app/profile?game=${playedGameId}` : '/app/profile'
    }
    default:
      return '/app/dashboard'
  }
}

function iconFor(type: string) {
  switch (type) {
    case 'connection_request':
    case 'connection_accepted':
      return UserPlus
    case 'connection_declined':
      return XCircle
    case 'league_invite':
      return Trophy
    case 'played_game_accepted':
      return CheckCircle2
    case 'played_game_rejected':
      return XCircle
    case 'connection_game_logged': return Dices
    case 'reaction_received': return Sparkles
    default:
      return Bell
  }
}

function colorFor(type: string): string {
  switch (type) {
    case 'connection_accepted':
    case 'played_game_accepted':
      return '#16a34a'
    case 'connection_declined':
    case 'played_game_rejected':
      return '#dc2626'
    case 'league_invite':
      return '#f5a623'
    case 'connection_game_logged':
    case 'reaction_received':
      return '#f5a623'
    default:
      return '#9a8878'
  }
}

export function NotificationsClient({
  notifications,
  page,
  totalPages,
  filter,
  locale,
}: {
  notifications: Notification[]
  page: number
  totalPages: number
  filter: 'all' | 'unread'
  locale: string
}) {
  const t = useTranslations('app.notifications')
  const [list, setList] = useState(notifications)
  const [pending, startTransition] = useTransition()
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'

  function label(n: Notification): string {
    const from = String(n.meta?.fromEmail ?? t('someone'))
    const leagueName = typeof n.meta?.leagueName === 'string' ? n.meta.leagueName : null
    switch (n.type) {
      case 'connection_request': return t('connectionRequest', { from })
      case 'connection_accepted': return t('connectionAccepted', { from })
      case 'connection_declined': return t('connectionDeclined', { from })
      case 'league_invite': return leagueName ? t('leagueInviteNamed', { from, leagueName }) : t('leagueInvite', { from })
      case 'played_game_accepted': return leagueName ? t('gameAcceptedNamed', { leagueName }) : t('gameAccepted')
      case 'played_game_rejected': return leagueName ? t('gameRejectedNamed', { leagueName }) : t('gameRejected')
      case 'connection_game_logged': {
        const gameName = typeof n.meta?.gameName === 'string' ? n.meta.gameName : ''
        return leagueName ? t('connectionGameLoggedNamed', { gameName, leagueName }) : t('connectionGameLogged')
      }
      case 'reaction_received': {
        const emoji = typeof n.meta?.emoji === 'string' ? n.meta.emoji : '✨'
        return t('reactionReceived', { emoji })
      }
      default: return t('newNotification')
    }
  }

  function handleRowClick(n: Notification) {
    if (n.read) return
    setList(items => items.map(i => i.id === n.id ? { ...i, read: true } : i))
    startTransition(() => { markNotificationRead(n.id) })
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setList(items => items.filter(i => i.id !== id))
    startTransition(() => { deleteNotification(id) })
  }

  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('filter', filter)
    params.set('page', String(p))
    return `?${params.toString()}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter pills */}
      <div className="flex gap-2">
        <Link
          href="?"
          className="px-3 py-1.5 rounded-full font-headline font-bold text-xs"
          style={filter === 'all'
            ? { background: '#f5a623', color: '#1c1408' }
            : { background: '#fefcf8', color: '#1e1a14', border: '1px solid #e8e1d8' }
          }
        >
          {t('filterAll')}
        </Link>
        <Link
          href="?filter=unread"
          className="px-3 py-1.5 rounded-full font-headline font-bold text-xs"
          style={filter === 'unread'
            ? { background: '#f5a623', color: '#1c1408' }
            : { background: '#fefcf8', color: '#1e1a14', border: '1px solid #e8e1d8' }
          }
        >
          {t('filterUnread')}
        </Link>
      </div>

      {/* List */}
      <section className="rounded-2xl overflow-hidden" style={{ background: '#fefcf8', border: '1px solid #e8e1d8' }}>
        {list.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center gap-3 text-center">
            <Inbox size={32} style={{ color: '#c5b89f' }} />
            <p className="font-body text-sm" style={{ color: '#9a8878' }}>
              {filter === 'unread' ? t('emptyUnread') : t('noNotifications')}
            </p>
          </div>
        ) : (
          <ul>
            {list.map((n, i) => {
              const Icon = iconFor(n.type)
              const color = colorFor(n.type)
              return (
                <li
                  key={n.id}
                  className="relative"
                  style={{
                    borderBottom: i < list.length - 1 ? '1px solid #f0ebe3' : undefined,
                    background: n.read ? 'transparent' : 'rgba(245,166,35,0.05)',
                  }}
                >
                  <Link
                    href={hrefFor(n)}
                    onClick={() => handleRowClick(n)}
                    className="flex items-start gap-3 px-4 py-3 pr-12"
                  >
                    <Icon size={20} style={{ color, flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm" style={{ color: '#1e1a14' }}>{label(n)}</p>
                      <p className="font-body text-xs mt-0.5" style={{ color: '#9a8878' }}>
                        {new Date(n.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.read && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f5a623', flexShrink: 0, marginTop: 8 }} />
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={e => handleDelete(n.id, e)}
                    disabled={pending}
                    aria-label={t('delete')}
                    title={t('delete')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors text-[#9a8878] enabled:hover:bg-[rgba(220,38,38,0.08)] enabled:hover:text-[#dc2626] enabled:focus-visible:bg-[rgba(220,38,38,0.08)] enabled:focus-visible:text-[#dc2626]"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #f0ebe3', background: '#fbf6ec' }}>
            {page > 1
              ? <Link href={buildHref(page - 1)} className="font-body text-xs" style={{ color: '#1e1a14' }}>{t('paginationPrev')}</Link>
              : <span className="font-body text-xs" style={{ color: '#c5b89f' }}>{t('paginationPrev')}</span>
            }
            <span className="font-body text-xs" style={{ color: '#9a8878' }}>{t('pagination', { page, total: totalPages })}</span>
            {page < totalPages
              ? <Link href={buildHref(page + 1)} className="font-body text-xs" style={{ color: '#1e1a14' }}>{t('paginationNext')}</Link>
              : <span className="font-body text-xs" style={{ color: '#c5b89f' }}>{t('paginationNext')}</span>
            }
          </div>
        )}
      </section>
    </div>
  )
}
