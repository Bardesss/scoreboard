export function StatBar({
  label,
  value,
  ratio,
  highlighted,
  dimmed,
  trailingLabel,
}: {
  label: string
  value: string
  ratio: number       // 0..1
  highlighted?: boolean
  dimmed?: boolean
  trailingLabel?: string
}) {
  const barColor = highlighted ? '#f5a623' : dimmed ? '#dbd0bc' : '#c5b89f'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: highlighted ? 700 : 400, color: dimmed ? '#9a8c7a' : '#1e1a14' }}>
          {label}
          {trailingLabel && <span>{trailingLabel}</span>}
        </span>
        <span style={{ fontSize: 12, color: dimmed ? '#9a8c7a' : '#6b5e4a' }}>{value}</span>
      </div>
      <div style={{ background: '#ede5d8', borderRadius: 4, height: 7 }}>
        <div
          className="stats-bar"
          style={
            {
              background: barColor,
              borderRadius: 4,
              height: 7,
              ['--stats-bar-target' as string]: `${Math.round(ratio * 100)}%`,
              width: 'var(--stats-bar-target)',
              minWidth: ratio > 0 ? 4 : 0,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  )
}
