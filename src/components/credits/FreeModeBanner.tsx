'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const DISMISS_KEY = 'dvFreeModeBannerDismissedAt'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000  // 7 days

type Props = {
  text: string
  dismissAriaLabel: string
}

export function FreeModeBanner({ text, dismissAriaLabel }: Props) {
  // Start hidden so SSR markup matches the dismissed case; flip in useEffect.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) {
      setVisible(true)
      return
    }
    const dismissedAt = Date.parse(raw)
    if (Number.isNaN(dismissedAt)) {
      setVisible(true)
      return
    }
    if (Date.now() - dismissedAt >= COOLDOWN_MS) {
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
      className="fixed top-14 lg:top-0 left-0 right-0 z-30 lg:left-64 flex items-center justify-between gap-3 px-4 py-2"
      style={{ background: '#f5a623', color: '#1c1408' }}
      role="status"
    >
      <span className="font-headline font-semibold text-xs flex-1 min-w-0">{text}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={dismissAriaLabel}
        className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-black/10"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}
