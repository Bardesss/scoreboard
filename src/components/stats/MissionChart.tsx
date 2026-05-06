'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { MissionStat } from '@/lib/stats/types'

export function MissionChart({ missions }: { missions: MissionStat[] }) {
  if (missions.length <= 2) {
    return (
      <div style={{ padding: '0 18px' }}>
        {missions.map((m, i) => (
          <div key={m.name} style={{ display: 'flex', padding: '8px 0', borderBottom: i < missions.length - 1 ? '1px solid #f2ece3' : undefined }}>
            <span style={{ flex: 1, fontSize: 13 }}>{m.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{m.count}×</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ padding: '12px 8px', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={missions} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#1e1a14' }} />
          <Tooltip cursor={{ fill: 'rgba(245,166,35,0.08)' }} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {missions.map((_, i) => <Cell key={i} fill={i === 0 ? '#f5a623' : '#c5b89f'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
