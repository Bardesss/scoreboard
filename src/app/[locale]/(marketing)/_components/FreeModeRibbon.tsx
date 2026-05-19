'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const DISMISS_KEY = 'dvFreeModeBannerDismissedAt'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

type Props = {
  text: string
  dismissAriaLabel: string
}

export function FreeModeRibbon({ text, dismissAriaLabel }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) { setVisible(true); return }
    const dismissedAt = Date.parse(raw)
    if (Number.isNaN(dismissedAt) || Date.now() - dismissedAt >= COOLDOWN_MS) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="status"
      style={{
        background: 'linear-gradient(90deg, rgba(245,166,35,0.18), rgba(245,166,35,0.10))',
        borderBottom: '1px solid rgba(245,166,35,0.28)',
        color: '#ede8dd',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between gap-3">
        <span className="font-headline font-semibold text-[12px]" style={{ color: '#f5a623' }}>
          {text}
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label={dismissAriaLabel}
          className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-white/5"
          style={{ color: 'rgba(245,166,35,0.7)' }}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
