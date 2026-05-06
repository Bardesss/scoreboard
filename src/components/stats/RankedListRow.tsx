import type { ReactNode } from 'react'

export function RankedListRow({
  rank,
  isLast,
  highlighted,
  children,
}: {
  rank: number
  isLast: boolean
  highlighted?: boolean
  children: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: !isLast ? '1px solid #f2ece3' : undefined,
        ...(highlighted
          ? { background: 'rgba(245,166,35,0.07)', margin: '0 -18px', padding: '8px 18px' }
          : {}),
      }}
    >
      <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: rank <= 3 ? '#f5a623' : '#9a8c7a', flexShrink: 0 }}>
        {rank}
      </span>
      {children}
    </div>
  )
}
