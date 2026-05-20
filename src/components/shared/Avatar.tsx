const COLORS = ['#f5a623', '#e85d26', '#2563eb', '#16a34a', '#7c3aed', '#db2777', '#0891b2']

function hashColor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

/**
 * Renders a user/player avatar. When `icon` is set, shows that pictogram on the
 * `color` background (the customised account avatar). Otherwise falls back to
 * the initials on a seed-hashed colour.
 */
export function Avatar({
  seed,
  name,
  size = 36,
  color,
  icon,
}: {
  seed: string
  name: string
  size?: number
  color?: string | null
  icon?: string | null
}) {
  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  if (icon) {
    return (
      <div style={{ ...box, background: color || hashColor(seed) }}>
        <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>{icon}</span>
      </div>
    )
  }

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'

  return (
    <div style={{ ...box, background: hashColor(seed) }}>
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
