import { useId } from 'react'

type FlagProps = {
  width?: number
  height?: number
  className?: string
}

export function FlagNL({ width = 22, height = 16, className }: FlagProps) {
  return (
    <svg
      viewBox="0 0 9 6"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Nederlandse vlag"
      style={{ borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
    >
      <rect width="9" height="6" fill="#21468B" />
      <rect width="9" height="4" fill="#FFFFFF" />
      <rect width="9" height="2" fill="#AE1C28" />
    </svg>
  )
}

export function FlagGB({ width = 22, height = 16, className }: FlagProps) {
  const id = useId().replace(/:/g, '')
  const clipId = `flag-gb-clip-${id}`
  return (
    <svg
      viewBox="0 0 60 30"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Union Jack"
      preserveAspectRatio="none"
      style={{ borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
    >
      <clipPath id={clipId}>
        <path d="M30,15 h30 v15 z M30,15 v15 h-30 z M30,15 h-30 v-15 z M30,15 v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clipId})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  )
}
