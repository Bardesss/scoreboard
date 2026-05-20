type Props = {
  username: string
  displayName: string | null
  avatarSeed: string
  gamesCount: number
  winsCount: number
  winRate: number  // 0..1
}

export function PublicProfileHero({ username, displayName, avatarSeed: _avatarSeed, gamesCount, winsCount, winRate }: Props) {
  const name = displayName || username
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #fff3d4, #fff7d8)',
        backgroundImage: 'radial-gradient(rgba(245,166,35,0.12) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        borderRadius: 24,
        padding: '32px 24px',
      }}
    >
      <div className="flex items-center gap-4">
        <div
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#f5a623', border: '3px solid #f5a623',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 28, color: '#fefcf8',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1
            style={{
              fontFamily: 'var(--font-headline)', fontWeight: 900,
              fontSize: 38, color: '#1e1a14', letterSpacing: '-0.03em',
              textShadow: '0 0 36px rgba(245,166,35,0.3)',
              textTransform: 'uppercase', lineHeight: 1,
            }}
          >
            {name}
          </h1>
          <p style={{ fontSize: 14, color: '#6b5e4a', marginTop: 8 }}>
            @{username} · {gamesCount} games · {winsCount} wins · {Math.round(winRate * 100)}% wr
          </p>
        </div>
      </div>
    </div>
  )
}
