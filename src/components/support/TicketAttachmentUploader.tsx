'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_BYTES = 3 * 1024 * 1024
const MAX_FILES = 4
const ACCEPT_EXTS = '.jpg,.jpeg,.png,.heic,.heif'
const ACCEPT_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']

type Selection = {
  file: File
  previewUrl: string | null
  isHeic: boolean
  error: string | null
  key: string
}

export type AttachmentVariant = 'app' | 'admin'

export type AttachmentLabels = {
  label: string
  dropHere: string
  hint: string
  maxReached: string
  remove: string
  errorType: string
  errorSize: string
}

type Theme = {
  zoneBg: string
  zoneBorder: string
  zoneBgHover: string
  zoneText: string
  hintText: string
  errorText: string
  thumbBg: string
  thumbBorder: string
  removeBg: string
  removeColor: string
  filenameColor: string
  sizeColor: string
}

const themes: Record<AttachmentVariant, Theme> = {
  app: {
    zoneBg: '#fffdf9',
    zoneBorder: '#e8e1d8',
    zoneBgHover: '#fef9ed',
    zoneText: '#9a8878',
    hintText: '#c4b79a',
    errorText: '#dc2626',
    thumbBg: '#fef3e2',
    thumbBorder: '#f5e7c8',
    removeBg: '#1c1810',
    removeColor: '#ffffff',
    filenameColor: '#1c1810',
    sizeColor: '#9a8878',
  },
  admin: {
    zoneBg: 'rgba(255,255,255,0.04)',
    zoneBorder: 'rgba(255,255,255,0.18)',
    zoneBgHover: 'rgba(74,142,255,0.08)',
    zoneText: 'rgba(255,255,255,0.55)',
    hintText: 'rgba(255,255,255,0.35)',
    errorText: '#f87171',
    thumbBg: 'rgba(255,255,255,0.06)',
    thumbBorder: 'rgba(255,255,255,0.1)',
    removeBg: 'rgba(0,0,0,0.7)',
    removeColor: '#ffffff',
    filenameColor: 'rgba(255,255,255,0.87)',
    sizeColor: 'rgba(255,255,255,0.45)',
  },
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function isHeicFile(file: File): boolean {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true
  const name = file.name.toLowerCase()
  return name.endsWith('.heic') || name.endsWith('.heif')
}

function validate(file: File, labels: AttachmentLabels): string | null {
  const heic = isHeicFile(file)
  const looksValid = ACCEPT_MIMES.includes(file.type) || heic
  if (!looksValid) return labels.errorType
  if (file.size > MAX_BYTES) return labels.errorSize
  return null
}

export function TicketAttachmentUploader({ variant, labels }: { variant: AttachmentVariant; labels: AttachmentLabels }) {
  const theme = themes[variant]
  const [items, setItems] = useState<Selection[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = fileInputRef.current
    if (!input) return
    const dt = new DataTransfer()
    items.filter(i => !i.error).forEach(i => dt.items.add(i.file))
    input.files = dt.files
  }, [items])

  useEffect(() => {
    return () => {
      items.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = useCallback((list: FileList | File[]) => {
    setItems(prev => {
      const incoming = Array.from(list)
      const room = MAX_FILES - prev.length
      const slice = incoming.slice(0, Math.max(0, room))
      const next: Selection[] = slice.map(file => {
        const error = validate(file, labels)
        const heic = isHeicFile(file)
        const previewUrl = !error && !heic ? URL.createObjectURL(file) : null
        return {
          file,
          previewUrl,
          isHeic: heic,
          error,
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        }
      })
      return [...prev, ...next]
    })
  }, [labels])

  const removeAt = (key: string) => {
    setItems(prev => {
      const removed = prev.find(i => i.key === key)
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter(i => i.key !== key)
    })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }

  const onZoneClick = () => inputRef.current?.click()
  const atMax = items.length >= MAX_FILES

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label
        className="font-headline font-semibold text-sm"
        style={{ color: theme.zoneText, display: 'block' }}
      >
        {labels.label}
      </label>

      <div
        onClick={atMax ? undefined : onZoneClick}
        onKeyDown={e => {
          if (!atMax && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onZoneClick()
          }
        }}
        onDragOver={e => { e.preventDefault(); if (!atMax) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={atMax ? e => e.preventDefault() : onDrop}
        role="button"
        tabIndex={atMax ? -1 : 0}
        aria-disabled={atMax}
        style={{
          border: `1px dashed ${dragOver ? '#f5a623' : theme.zoneBorder}`,
          background: dragOver ? theme.zoneBgHover : theme.zoneBg,
          borderRadius: 14,
          padding: '18px 14px',
          textAlign: 'center',
          cursor: atMax ? 'not-allowed' : 'pointer',
          transition: 'background 120ms, border-color 120ms',
          opacity: atMax ? 0.55 : 1,
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={theme.zoneText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21 12-7.586 7.586a4 4 0 0 1-5.656-5.656l8.486-8.486a3 3 0 0 1 4.242 4.243L12 18.172" />
          </svg>
          <p className="font-headline font-semibold text-sm" style={{ color: theme.zoneText, margin: 0 }}>
            {atMax ? labels.maxReached : labels.dropHere}
          </p>
          <p className="font-body text-xs" style={{ color: theme.hintText, margin: 0 }}>
            {labels.hint}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_EXTS}
          multiple
          onChange={e => e.target.files && addFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </div>

      <input ref={fileInputRef} name="attachments" type="file" multiple style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />

      {items.length > 0 && (
        <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map(item => (
            <li key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: theme.thumbBg,
                  border: `1px solid ${item.error ? theme.errorText : theme.thumbBorder}`,
                }}
              >
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt={item.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, padding: 8 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={theme.zoneText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <span style={{ fontSize: 10, fontWeight: 700, color: theme.zoneText, letterSpacing: 0.5 }}>
                      {item.isHeic ? 'HEIC' : ''}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeAt(item.key) }}
                  aria-label={labels.remove}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: theme.removeBg,
                    color: theme.removeColor,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="font-body text-xs" style={{ color: theme.filenameColor, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.file.name}
              </p>
              <p className="font-body text-xs" style={{ color: item.error ? theme.errorText : theme.sizeColor, margin: 0 }}>
                {item.error ?? formatBytes(item.file.size)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
