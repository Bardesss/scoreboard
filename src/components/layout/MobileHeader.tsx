'use client'

import Link from 'next/link'
import { Dices } from 'lucide-react'
import { NotificationBell } from './NotificationBell'

type NotificationItem = {
  id: string
  type: string
  meta: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

export default function MobileHeader({
  unreadCount,
  notifications,
}: {
  unreadCount: number
  notifications: NotificationItem[]
}) {
  return (
    <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4" style={{ background: 'rgba(247,243,237,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(245,166,35,0.1)' }}>
      <Link href="/app/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: '#f5a623', boxShadow: '0 4px 12px rgba(245,166,35,0.28)' }}>
          <Dices size={16} strokeWidth={2.2} style={{ color: '#1c1408' }} />
        </div>
        <span className="font-headline font-black text-[14px] text-on-surface tracking-[-0.02em]">Dice Vault</span>
      </Link>
      <NotificationBell initialCount={unreadCount} initialNotifications={notifications} />
    </header>
  )
}
