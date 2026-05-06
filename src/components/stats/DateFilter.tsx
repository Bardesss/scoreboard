'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useRouteTransition } from './TransitionDimmer'
import type { Range } from '@/lib/stats/types'

const PRESETS: { key: Exclude<Range, 'custom'>; labelNL: string; labelEN: string }[] = [
  { key: 'week',  labelNL: 'Deze week',  labelEN: 'This week' },
  { key: 'month', labelNL: 'Deze maand', labelEN: 'This month' },
  { key: 'year',  labelNL: 'Dit jaar',   labelEN: 'This year' },
  { key: 'all',   labelNL: 'Alles',      labelEN: 'All time' },
]

export function DateFilter({ locale }: { locale: 'nl' | 'en' }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startTransition } = useRouteTransition()

  const currentRange = (searchParams.get('range') ?? 'all') as Range
  const [showCustom, setShowCustom] = useState(currentRange === 'custom')
  const [from, setFrom] = useState(searchParams.get('from') ?? '')
  const [to, setTo] = useState(searchParams.get('to') ?? '')

  useEffect(() => {
    setFrom(searchParams.get('from') ?? '')
    setTo(searchParams.get('to') ?? '')
    setShowCustom(currentRange === 'custom')
  }, [searchParams, currentRange])

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
  }

  const pillBase = {
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #c5b89f',
    cursor: 'pointer',
    background: '#fefcf8',
    color: '#6b5e4a',
  } as const
  const pillActive = { background: '#fff3d4', color: '#c27f0a', borderColor: '#f5a623' }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 20 }}>
      {PRESETS.map(p => {
        const active = currentRange === p.key
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => { setShowCustom(false); pushRange(p.key) }}
            style={{ ...pillBase, ...(active ? pillActive : {}) }}
          >
            {locale === 'nl' ? p.labelNL : p.labelEN}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setShowCustom(v => !v)}
        style={{ ...pillBase, ...(currentRange === 'custom' ? pillActive : {}) }}
      >
        {locale === 'nl' ? 'Aangepast' : 'Custom'}
      </button>
      {showCustom && (
        <form
          onSubmit={e => { e.preventDefault(); if (from && to) pushRange('custom', { from, to }) }}
          style={{ display: 'flex', gap: 6, alignItems: 'center' }}
        >
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} required
                 style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #c5b89f', fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#6b5e4a' }}>—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} required
                 style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #c5b89f', fontSize: 12 }} />
          <button type="submit" style={{ ...pillBase, ...pillActive }}>
            {locale === 'nl' ? 'Toepassen' : 'Apply'}
          </button>
        </form>
      )}
    </div>
  )
}
