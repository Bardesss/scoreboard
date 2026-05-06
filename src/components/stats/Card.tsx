import type { ReactNode, CSSProperties } from 'react'

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: '#fefcf8',
        border: '1px solid #c5b89f',
        borderRadius: 16,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
