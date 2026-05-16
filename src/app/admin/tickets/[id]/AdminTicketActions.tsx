'use client'

import { useActionState, useState } from 'react'
import { adminReplyToTicket, adminCloseTicket } from '../actions'
import { TicketAttachmentUploader } from '@/components/support/TicketAttachmentUploader'

const ADMIN_LABELS = {
  label: 'Screenshots toevoegen (optioneel)',
  dropHere: 'Sleep afbeeldingen hierheen of klik om te kiezen',
  hint: 'JPG, PNG, HEIC · max 3 MB · maximaal 4 bestanden',
  maxReached: 'Maximaal 4 bijlagen',
  remove: 'Verwijder',
  errorType: 'Alleen JPG-, PNG- en HEIC-afbeeldingen zijn toegestaan',
  errorSize: 'Bestand is groter dan 3 MB',
}

export default function AdminTicketActions({ ticketId, status }: { ticketId: string; status: string }) {
  const [showClose, setShowClose] = useState(false)
  const [replyState, replyAction, replyPending] = useActionState(
    async (_: unknown, fd: FormData) => adminReplyToTicket(ticketId, fd),
    null
  )
  const [closeState, closeAction, closePending] = useActionState(
    async () => adminCloseTicket(ticketId),
    null
  )

  if (status === 'closed') {
    return <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Dit ticket is gesloten.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form action={replyAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <textarea name="body" required rows={4} placeholder="Antwoord typen…" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        <TicketAttachmentUploader variant="admin" labels={ADMIN_LABELS} />
        {replyState && !replyState.success && <p style={{ color: '#f87171', fontSize: 13 }}>{replyState.error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={replyPending} style={{ background: '#4a8eff', color: '#fff', fontWeight: 700, fontSize: 14, padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
            {replyPending ? '…' : 'Stuur antwoord'}
          </button>
          {!showClose ? (
            <button type="button" onClick={() => setShowClose(true)} style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 14, padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              Ticket sluiten
            </button>
          ) : (
            <form action={closeAction} style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={closePending} style={{ background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14, padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {closePending ? '…' : 'Bevestig sluiten'}
              </button>
              <button type="button" onClick={() => setShowClose(false)} style={{ background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '9px 14px', border: 'none', cursor: 'pointer' }}>
                Annuleer
              </button>
            </form>
          )}
        </div>
      </form>
      {closeState && !closeState.success && <p style={{ color: '#f87171', fontSize: 13 }}>{closeState.error}</p>}
    </div>
  )
}
