import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  trailing?: ReactNode
}

export function PageHeader({ title, subtitle, trailing }: Props) {
  return (
    <header className="flex items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1
          className="font-headline font-black text-2xl tracking-[-0.02em]"
          style={{ color: '#1e1a14' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="font-body text-sm mt-1"
            style={{ color: '#6b5e4a' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </header>
  )
}
