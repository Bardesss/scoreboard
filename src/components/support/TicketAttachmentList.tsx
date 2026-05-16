'use client'

import { useEffect, useState } from 'react'
import type { AttachmentVariant } from './TicketAttachmentUploader'

export type AttachmentItem = {
  id: string
  filename: string
  deletedAt: Date | string | null
}

export type AttachmentListLabels = {
  deleted: string
  close: string
}

type Theme = {
  thumbBg: string
  thumbBorder: string
  placeholderBg: string
  placeholderBorder: string
  placeholderIcon: string
  placeholderText: string
  lightboxBg: string
  lightboxClose: string
}

const themes: Record<AttachmentVariant, Theme> = {
  app: {
    thumbBg: '#fef3e2',
    thumbBorder: '#f5e7c8',
    placeholderBg: 'transparent',
    placeholderBorder: '#d6c9b1',
    placeholderIcon: '#9a8878',
    placeholderText: '#9a8878',
    lightboxBg: 'rgba(28, 24, 16, 0.92)',
    lightboxClose: '#ffffff',
  },
  admin: {
    thumbBg: 'rgba(255,255,255,0.06)',
    thumbBorder: 'rgba(255,255,255,0.1)',
    placeholderBg: 'transparent',
    placeholderBorder: 'rgba(255,255,255,0.2)',
    placeholderIcon: 'rgba(255,255,255,0.45)',
    placeholderText: 'rgba(255,255,255,0.5)',
    lightboxBg: 'rgba(0,0,0,0.85)',
    lightboxClose: '#ffffff',
  },
}

export function TicketAttachmentList({
  ticketId,
  attachments,
  variant,
  labels,
}: {
  ticketId: string
  attachments: AttachmentItem[]
  variant: AttachmentVariant
  labels: AttachmentListLabels
}) {
  const theme = themes[variant]
  const [lightbox, setLightbox] = useState<{ id: string; filename: string } | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightbox])

  if (attachments.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {attachments.map(att => {
          const deleted = !!att.deletedAt
          if (deleted) {
            return (
              <div
                key={att.id}
                title={labels.deleted}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: theme.placeholderBg,
                  border: `1px dashed ${theme.placeholderBorder}`,
                  maxWidth: 200,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.placeholderIcon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m21 12-7.586 7.586a4 4 0 0 1-5.656-5.656l8.486-8.486a3 3 0 0 1 4.242 4.243L12 18.172" />
                </svg>
                <span className="font-body text-xs" style={{ color: theme.placeholderText, lineHeight: 1.3 }}>
                  {labels.deleted}
                </span>
              </div>
            )
          }
          const url = `/api/tickets/${ticketId}/attachments/${att.id}`
          return (
            <button
              key={att.id}
              type="button"
              onClick={() => setLightbox({ id: att.id, filename: att.filename })}
              aria-label={att.filename}
              style={{
                padding: 0,
                border: `1px solid ${theme.thumbBorder}`,
                background: theme.thumbBg,
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'zoom-in',
                width: 120,
                height: 120,
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={att.filename}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          )
        })}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.filename}
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: theme.lightboxBg,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label={labels.close}
            style={{
              position: 'absolute',
              top: 16,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.4)',
              color: theme.lightboxClose,
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/tickets/${ticketId}/attachments/${lightbox.id}`}
            alt={lightbox.filename}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          />
        </div>
      )}
    </>
  )
}
