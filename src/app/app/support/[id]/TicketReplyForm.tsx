'use client'

import { useActionState } from 'react'
import { replyToTicket } from '../actions'

export default function TicketReplyForm({ ticketId, replyLabel, placeholder }: { ticketId: string; replyLabel: string; placeholder: string }) {
  const [state, formAction, pending] = useActionState(
    async (_: unknown, fd: FormData) => replyToTicket(ticketId, fd.get('body') as string),
    null
  )

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <textarea name="body" required maxLength={5000} rows={4} placeholder={placeholder} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
      {state && !state.success && <p style={{ color: '#f87171', fontSize: 13 }}>{state.error}</p>}
      <button type="submit" disabled={pending} style={{ alignSelf: 'flex-end', background: '#f5a623', color: '#1c1408', fontWeight: 700, fontSize: 14, padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
        {pending ? '…' : replyLabel}
      </button>
    </form>
  )
}
