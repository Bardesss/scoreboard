'use client'

import { useEffect, useRef, useState } from 'react'

export function AnimatedNumber({ value, durationMs = 600 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0)
  const startTs = useRef<number | null>(null)
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reducedMotion) { setDisplay(value); return }
    let raf = 0
    const tick = (ts: number) => {
      if (startTs.current === null) startTs.current = ts
      const t = Math.min(1, (ts - startTs.current) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(value * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); startTs.current = null }
  }, [value, durationMs, reducedMotion])

  return <>{display}</>
}
