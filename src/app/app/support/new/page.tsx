'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createTicket } from '../actions'

export default function NewTicketPage() {
  const t = useTranslations('support')
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
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.87)', marginBottom: 24 }}>{t('newTicket')}</h1>
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>{t('category')}</label>
          <select name="category" required style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14 }}>
            <option value="bug">{t('categoryBug')}</option>
            <option value="feedback">{t('categoryFeedback')}</option>
            <option value="question">{t('categoryQuestion')}</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>{t('subject')}</label>
          <input name="subject" required maxLength={200} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>{t('message')}</label>
          <textarea name="body" required maxLength={5000} rows={6} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.87)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        {state && !state.success && (
          <p style={{ color: '#f87171', fontSize: 13 }}>{state.error}</p>
        )}
        <button type="submit" disabled={pending} style={{ background: '#f5a623', color: '#1c1408', fontWeight: 700, fontSize: 14, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
          {pending ? '…' : t('submit')}
        </button>
      </form>
    </div>
  )
}
