import type { TrophyEntry } from '@/lib/social/trophyShelf'

export function TrophyShelf({ entries, heading }: { entries: TrophyEntry[]; heading: string }) {
  if (entries.length === 0) return null
  return (
    <section style={{ marginTop: 24 }}>
      <h2
        style={{
          fontFamily: 'var(--font-headline)', fontWeight: 700,
          fontSize: 13, color: '#9a8878', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 12,
        }}
      >
        {heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {entries.map(e => (
          <div
            key={e.templateId}
            style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 16, overflow: 'hidden' }}
          >
            <div style={{ height: 4, background: e.color }} />
            <div style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 20 }}>{e.icon}</span>
                <span style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 14, color: '#1e1a14' }}>
                  {e.name}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b5e4a' }}>
                {e.plays} games · {Math.round(e.winRate * 100)}% wr
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
