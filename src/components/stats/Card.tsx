import type { ReactNode, CSSProperties } from 'react'

export function Card({ children, style, index }: { children: ReactNode; style?: CSSProperties; index?: number }) {
  const vars = index !== undefined ? ({ ['--stats-card-index' as string]: index } as CSSProperties) : {}
  return (
    <div
      className="stats-card"
      style={{
        background: '#fefcf8',
        border: '1px solid #c5b89f',
        borderRadius: 16,
        overflow: 'hidden',
        ...vars,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
