'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markAllNotificationsRead } from '@/app/app/notifications/actions'

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

export function NotificationBell({
  initialCount,
  initialNotifications,
  position = 'down-left',
}: {
  initialCount: number
  initialNotifications: Notification[]
  position?: 'down-left' | 'up-right'
}) {
  const t = useTranslations('app.notifications')
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [notifications] = useState(initialNotifications)

  function notificationLabel(n: Notification): string {
    const from = String(n.meta?.fromEmail ?? t('someone'))
    const leagueName = typeof n.meta?.leagueName === 'string' ? n.meta.leagueName : null
    switch (n.type) {
      case 'connection_request':  return t('connectionRequest', { from })
      case 'connection_accepted': return t('connectionAccepted', { from })
      case 'connection_declined': return t('connectionDeclined', { from })
      case 'league_invite':       return leagueName ? t('leagueInviteNamed', { from, leagueName }) : t('leagueInvite', { from })
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

  async function handleOpen() {
    setOpen(o => !o)
    if (!open && count > 0) {
      setCount(0)
      await markAllNotificationsRead()
    }
  }

  return (
    <div className="relative">
      <button onClick={handleOpen} className="relative p-2 rounded-xl transition-colors hover:bg-white/5">
        <Bell size={20} style={{ color: count > 0 ? '#f5a623' : '#9a8878' }} />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center font-headline font-black text-[9px]"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute w-72 rounded-2xl shadow-xl z-50 overflow-hidden ${position === 'up-right' ? 'left-0 bottom-full mb-2' : 'right-0 top-full mt-2'}`}
          style={{ background: '#fefcf8', border: '1px solid #e8e1d8' }}
        >
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center font-body text-sm" style={{ color: '#9a8878' }}>{t('noNotifications')}</p>
          ) : (
            <ul>
              {notifications.map(n => (
                <li
                  key={n.id}
                  className="border-b last:border-b-0"
                  style={{
                    borderColor: '#f0ebe3',
                    background: n.read ? 'transparent' : 'rgba(245,166,35,0.04)',
                  }}
                >
                  <Link
                    href={hrefFor(n)}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 font-body text-sm transition-colors"
                    style={{ color: '#1e1a14' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,166,35,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <p>{notificationLabel(n)}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9a8878' }}>
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center font-headline font-bold text-xs transition-colors"
            style={{ borderTop: '1px solid #f0ebe3', color: '#f5a623', background: '#fbf6ec' }}
          >
            {t('viewAll')}
          </Link>
        </div>
      )}
    </div>
  )
}
