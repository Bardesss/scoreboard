'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { markAllNotificationsRead } from '@/app/app/notifications/actions'

type Notification = {
  id: string
  type: string
  meta: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

function notificationLabel(n: Notification): string {
  switch (n.type) {
    case 'connection_request': return `${n.meta?.fromEmail ?? 'Someone'} wants to connect`
    case 'connection_accepted': return `${n.meta?.fromEmail ?? 'Someone'} accepted your request`
    case 'connection_declined': return `${n.meta?.fromEmail ?? 'Someone'} declined your request`
    case 'played_game_pending': return 'A game submission needs your approval'
    case 'played_game_accepted': return 'Your game submission was approved'
    case 'played_game_rejected': return 'Your game submission was rejected'
    default: return 'New notification'
  }
}

export function NotificationBell({
  initialCount,
  initialNotifications,
}: {
  initialCount: number
  initialNotifications: Notification[]
}) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [notifications] = useState(initialNotifications)

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
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-xl z-50 overflow-hidden"
          style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}
        >
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center font-body text-sm" style={{ color: '#9a8878' }}>No notifications</p>
          ) : (
            <ul>
              {notifications.map(n => (
                <li
                  key={n.id}
                  className="px-4 py-3 border-b last:border-b-0 font-body text-sm"
                  style={{
                    borderColor: '#f0ebe3',
                    color: '#1c1810',
                    background: n.read ? 'transparent' : 'rgba(245,166,35,0.04)',
                  }}
                >
                  <p>{notificationLabel(n)}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9a8878' }}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
