import type { UmamiSummary, UmamiSeriesPoint } from '@/lib/umami'
import AnalyticsTrendChart from './AnalyticsTrendChart'
import AnalyticsLiveCount from './AnalyticsLiveCount'
import { Users, Eye, MousePointerClick, LogOut, Clock } from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: '#161f28',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 20,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Delta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev === null || prev === 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  const color = pct > 0 ? '#4ade80' : pct < 0 ? '#f87171' : 'rgba(255,255,255,0.4)'
  return (
    <span style={{ fontSize: 12, color, fontWeight: 600 }}>
      {pct > 0 ? '+' : ''}
      {pct}%
    </span>
  )
}

export default function AnalyticsSection({
  summary,
  series,
}: {
  summary: UmamiSummary | null
  series: UmamiSeriesPoint[]
}) {
  const kpis = summary
    ? [
        { label: 'Bezoekers', value: summary.visitors, prev: summary.prev.visitors, icon: Users },
        { label: 'Paginaweergaven', value: summary.pageviews, prev: summary.prev.pageviews, icon: Eye },
        { label: 'Bezoeken', value: summary.visits, prev: summary.prev.visits, icon: MousePointerClick },
        { label: 'Bouncepercentage', value: `${summary.bounceRate}%`, prev: null, icon: LogOut },
        { label: 'Gem. bezoekduur', value: formatDuration(summary.avgVisitTime), prev: null, icon: Clock },
      ]
    : []

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 className="font-headline" style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>
          Website-analyse
        </h2>
        <AnalyticsLiveCount />
      </div>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>laatste 30 dagen</p>

      {summary === null ? (
        <div
          style={{
            background: '#161f28',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 20,
            fontSize: 14,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Analytics tijdelijk niet beschikbaar.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {kpis.map(({ label, value, prev, icon: Icon }) => (
              <div key={label} style={cardStyle}>
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: 'rgba(74,142,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} style={{ color: '#4a8eff' }} />
                </div>
                <span
                  className="font-headline"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  {label}
                </span>
                <span className="font-headline" style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.87)', lineHeight: 1 }}>
                  {value}
                </span>
                {typeof value === 'number' && <Delta cur={value} prev={prev} />}
              </div>
            ))}
          </div>

          <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
            <AnalyticsTrendChart series={series} />
          </div>
        </>
      )}
    </div>
  )
}
