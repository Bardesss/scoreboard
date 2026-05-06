'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { WinTrendSeries } from '@/lib/stats/types'

export function WinTrendChart({ series }: { series: WinTrendSeries }) {
  return (
    <div style={{ padding: '12px 8px', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series.points} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <XAxis dataKey="gameIndex" tick={{ fontSize: 11, fill: '#6b5e4a' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b5e4a' }} width={30} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.players.map(p => (
            <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={p.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
