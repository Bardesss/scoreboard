import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="py-16 px-6 text-center">
      <div
        aria-hidden
        className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
        style={{ background: '#fff3d4', color: '#f5a623' }}
      >
        {icon}
      </div>
      <h3
        className="font-headline font-black text-base tracking-[-0.01em]"
        style={{ color: '#1e1a14' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="font-body text-sm mt-1.5 max-w-xs mx-auto"
          style={{ color: '#6b5e4a' }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
