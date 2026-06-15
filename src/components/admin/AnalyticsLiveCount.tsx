'use client'

import { useEffect, useState } from 'react'

/** Polls the admin live-count endpoint every 60s. Renders nothing until the
 * first successful fetch, and silently stays hidden on error. */
export default function AnalyticsLiveCount() {
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/analytics', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { active?: number }
        if (!cancelled) setActive(data.active ?? 0)
      } catch {
        /* ignore — badge just stays hidden */
      }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (active === null) return null

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#4ade80',
          boxShadow: '0 0 0 3px rgba(74,222,128,0.2)',
        }}
      />
      {active} online nu
    </span>
  )
}
