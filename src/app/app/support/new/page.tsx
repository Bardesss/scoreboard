'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createTicket } from '../actions'
import { TicketAttachmentUploader } from '@/components/support/TicketAttachmentUploader'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#fefcf8',
  border: '1px solid #e8e1d8',
  borderRadius: 12,
  color: '#1e1a14',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
}

export default function NewTicketPage() {
  const t = useTranslations('app.support')
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    async (_: unknown, fd: FormData) => createTicket(fd),
    null
  )

  useEffect(() => {
    if (state && state.success && 'ticketId' in state) {
      router.push(`/app/support/${state.ticketId}`)
    }
  }, [state, router])

  return (
    <div className="max-w-xl mx-auto py-8 px-2">
      <h1 className="font-headline font-black text-2xl mb-6" style={{ color: '#1e1a14' }}>{t('newTicket')}</h1>
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="font-headline font-semibold text-sm block mb-2" style={{ color: '#9a8878' }}>{t('category')}</label>
          <select name="category" required style={{ ...inputStyle, appearance: 'auto' }}>
            <option value="bug">{t('categoryBug')}</option>
            <option value="feedback">{t('categoryFeedback')}</option>
            <option value="question">{t('categoryQuestion')}</option>
          </select>
        </div>
        <div>
          <label className="font-headline font-semibold text-sm block mb-2" style={{ color: '#9a8878' }}>{t('subject')}</label>
          <input name="subject" required maxLength={200} style={inputStyle} />
        </div>
        <div>
          <label className="font-headline font-semibold text-sm block mb-2" style={{ color: '#9a8878' }}>{t('message')}</label>
          <textarea name="body" required maxLength={5000} rows={6} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <TicketAttachmentUploader
          variant="app"
          labels={{
            label: t('attachmentsLabel'),
            dropHere: t('attachmentsDropHere'),
            hint: t('attachmentsHint'),
            maxReached: t('attachmentsMaxReached'),
            remove: t('attachmentsRemove'),
            errorType: t('attachmentsErrorType'),
            errorSize: t('attachmentsErrorSize'),
          }}
        />
        {state && !state.success && (
          <p className="font-body text-sm" style={{ color: '#dc2626' }}>{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="font-headline font-bold text-sm rounded-2xl py-3"
          style={{ background: '#f5a623', color: '#1c1408', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}
        >
          {pending ? '…' : t('submit')}
        </button>
      </form>
    </div>
  )
}
