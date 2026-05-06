'use client'

import { createContext, useContext, useTransition, type ReactNode } from 'react'

type TransitionCtx = {
  isPending: boolean
  startTransition: (cb: () => void) => void
}

const Ctx = createContext<TransitionCtx | null>(null)

export function TransitionProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition()
  return <Ctx.Provider value={{ isPending, startTransition }}>{children}</Ctx.Provider>
}

export function useRouteTransition(): TransitionCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRouteTransition must be inside TransitionProvider')
  return v
}

export function DimmedWhilePending({ children }: { children: ReactNode }) {
  const { isPending } = useRouteTransition()
  return (
    <div
      style={{
        opacity: isPending ? 0.4 : 1,
        transition: 'opacity 150ms ease-out',
        position: 'relative',
      }}
    >
      {isPending && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <Spinner />
        </div>
      )}
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div
      aria-label="loading"
      style={{
        width: 16, height: 16,
        border: '2px solid #c5b89f',
        borderTopColor: '#f5a623',
        borderRadius: '50%',
        animation: 'stats-spin 800ms linear infinite',
      }}
    />
  )
}
