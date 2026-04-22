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
      <textarea
        name="body"
        required
        maxLength={5000}
        rows={4}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 14px', boxSizing: 'border-box',
          background: '#fffdf9', border: '1px solid #e8e1d8', borderRadius: 12,
          color: '#1c1810', fontSize: 14, resize: 'vertical', outline: 'none',
        }}
      />
      {state && !state.success && (
        <p className="font-body text-sm" style={{ color: '#dc2626' }}>{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="font-headline font-bold text-sm rounded-xl self-end px-6 py-2"
        style={{ background: '#f5a623', color: '#1c1408', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}
      >
        {pending ? '…' : replyLabel}
      </button>
    </form>
  )
}
