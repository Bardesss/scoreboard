'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { FrequencyBucket } from '@/lib/stats/types'

export function GamesFrequencyChart({ buckets }: { buckets: FrequencyBucket[] }) {
  if (buckets.length === 0) {
    return <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 18px' }}>Geen data voor deze periode.</p>
  }
  return (
    <div style={{ padding: '12px 8px', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b5e4a' }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b5e4a' }} width={30} />
          <Tooltip cursor={{ fill: 'rgba(245,166,35,0.08)' }} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" fill="#f5a623" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
