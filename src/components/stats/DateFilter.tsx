'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useRouteTransition } from './TransitionDimmer'
import type { Range } from '@/lib/stats/types'
import type { StatsLabels } from '@/lib/stats/buildStatsLabels'

type DateFilterLabels = Pick<
  StatsLabels,
  'rangeWeek' | 'rangeMonth' | 'rangeYear' | 'rangeAll' | 'rangeCustom' | 'rangeApply' | 'rangeFrom' | 'rangeTo'
>

export function DateFilter({ labels }: { labels: DateFilterLabels }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startTransition } = useRouteTransition()

  const presets: { key: Exclude<Range, 'custom'>; label: string }[] = [
    { key: 'week', label: labels.rangeWeek },
    { key: 'month', label: labels.rangeMonth },
    { key: 'year', label: labels.rangeYear },
    { key: 'all', label: labels.rangeAll },
  ]

  const currentRange = (searchParams.get('range') ?? 'all') as Range
  const [open, setOpen] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [from, setFrom] = useState(searchParams.get('from') ?? '')
  const [to, setTo] = useState(searchParams.get('to') ?? '')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFrom(searchParams.get('from') ?? '')
    setTo(searchParams.get('to') ?? '')
  }, [searchParams])

  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent | TouchEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCustomForm(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setShowCustomForm(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pushRange(next: Range, extra?: { from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', next)
    params.delete('from')
    params.delete('to')
    if (next === 'custom' && extra?.from && extra?.to) {
      params.set('from', extra.from)
      params.set('to', extra.to)
    }
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
    setOpen(false)
    setShowCustomForm(false)
  }

  const currentLabel = (() => {
    if (currentRange === 'custom') return labels.rangeCustom
    return presets.find(p => p.key === currentRange)?.label ?? labels.rangeAll
  })()

  const optionBase = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '10px 16px',
    border: 'none',
    cursor: 'pointer',
    background: 'transparent',
    color: '#1e1a14',
    fontSize: 13,
    fontWeight: 500,
    textAlign: 'left' as const,
    fontFamily: 'inherit',
  }
  const optionActive = { background: '#fff3d4', color: '#c27f0a', fontWeight: 700 }

  return (
    <div ref={wrapperRef} className="relative inline-block w-full sm:w-auto" style={{ marginBottom: 20 }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setShowCustomForm(false) }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full sm:w-auto"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 38,
          padding: '8px 14px',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid #c5b89f',
          background: '#fefcf8',
          color: '#1e1a14',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>🗓</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{currentLabel}</span>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            transition: 'transform 180ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: '#9a8c7a',
            fontSize: 10,
            marginLeft: 4,
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          className="stats-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: '100%',
            maxWidth: 'min(360px, 95vw)',
            background: '#fefcf8',
            border: '1px solid #c5b89f',
            borderRadius: 14,
            boxShadow: '0 8px 24px -8px rgba(60,40,15,0.18), 0 2px 4px -2px rgba(60,40,15,0.08)',
            overflow: 'hidden',
            zIndex: 30,
          }}
        >
          {!showCustomForm ? (
            <ul role="listbox" style={{ listStyle: 'none', margin: 0, padding: '6px 0' }}>
              {presets.map(p => {
                const active = currentRange === p.key
                return (
                  <li key={p.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pushRange(p.key)}
                      style={{ ...optionBase, ...(active ? optionActive : {}) }}
                    >
                      <span style={{ flex: 1 }}>{p.label}</span>
                      {active && <span aria-hidden style={{ fontSize: 12, marginLeft: 8 }}>✓</span>}
                    </button>
                  </li>
                )
              })}
              <li aria-hidden style={{ height: 1, background: '#f2ece3', margin: '6px 14px' }} />
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={currentRange === 'custom'}
                  onClick={() => setShowCustomForm(true)}
                  style={{
                    ...optionBase,
                    ...(currentRange === 'custom' ? optionActive : {}),
                  }}
                >
                  <span style={{ flex: 1 }}>{labels.rangeCustom}…</span>
                  {currentRange === 'custom' && <span aria-hidden style={{ fontSize: 12, marginLeft: 8 }}>✓</span>}
                </button>
              </li>
            </ul>
          ) : (
            <form
              onSubmit={e => {
                e.preventDefault()
                if (from && to) pushRange('custom', { from, to })
              }}
              style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6b5e4a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {labels.rangeFrom}
                </span>
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  required
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #c5b89f',
                    fontSize: 13,
                    background: '#fefcf8',
                    color: '#1e1a14',
                    fontFamily: 'inherit',
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6b5e4a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {labels.rangeTo}
                </span>
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  required
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #c5b89f',
                    fontSize: 13,
                    background: '#fefcf8',
                    color: '#1e1a14',
                    fontFamily: 'inherit',
                  }}
                />
              </label>
              <button
                type="submit"
                disabled={!from || !to}
                style={{
                  marginTop: 4,
                  padding: '9px 14px',
                  borderRadius: 999,
                  border: '1px solid #f5a623',
                  background: !from || !to ? '#f7f2e8' : '#fff3d4',
                  color: !from || !to ? '#bcae96' : '#c27f0a',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: !from || !to ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {labels.rangeApply}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
