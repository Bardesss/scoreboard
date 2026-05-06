import { Card } from './Card'

export function StatsSkeleton({ panelCount = 4, chart = false }: { panelCount?: number; chart?: boolean }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="stats-skeleton-block" style={{ width: 90, height: 28, borderRadius: 999 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }} className="sm:grid-cols-2 grid-cols-1">
        {Array.from({ length: panelCount }).map((_, i) => (
          <Card key={i}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #ede5d8' }}>
              <div className="stats-skeleton-block" style={{ height: 14, width: '50%' }} />
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chart
                ? <div className="stats-skeleton-block" style={{ height: 220 }} />
                : [1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="stats-skeleton-block" style={{ height: 9, width: `${90 - n * 8}%` }} />
                  ))
              }
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #ede5d8' }}>
          <div className="stats-skeleton-block" style={{ height: 14, width: '30%' }} />
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(n => <div key={n} className="stats-skeleton-block" style={{ height: 11 }} />)}
        </div>
      </Card>
    </>
  )
}
