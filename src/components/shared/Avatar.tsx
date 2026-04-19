const COLORS = ['#f5a623', '#e85d26', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#0891b2']

function hashColor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

export function Avatar({ seed, name, size = 36 }: { seed: string; name: string; size?: number }) {
  const bg = hashColor(seed)
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: '#fff',
          fontWeight: 700,
          fontSize: size * 0.36,
          fontFamily: 'var(--font-headline)',
          letterSpacing: '-0.01em',
        }}
      >
        {initials}
      </span>
    </div>
  )
}
