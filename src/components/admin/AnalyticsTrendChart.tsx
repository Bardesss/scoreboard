'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { UmamiSeriesPoint } from '@/lib/umami'

export default function AnalyticsTrendChart({ series }: { series: UmamiSeriesPoint[] }) {
  const data = series.map(p => ({ ...p, label: p.date.slice(5) })) // MM-DD

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="umamiViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a8eff" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#4a8eff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="umamiSessions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#0c0f10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="views" name="Weergaven" stroke="#4a8eff" fill="url(#umamiViews)" strokeWidth={2} />
          <Area type="monotone" dataKey="sessions" name="Sessies" stroke="#4ade80" fill="url(#umamiSessions)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
