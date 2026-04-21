import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Users, Gamepad2, LayoutTemplate, Trophy, Clock } from 'lucide-react'

export default async function AdminDashboardPage() {
  const [userCount, playedGameCount, templateCount, leagueCount, pendingCount, recentGames] =
    await Promise.all([
      prisma.user.count(),
      prisma.playedGame.count(),
      prisma.gameTemplate.count(),
      prisma.league.count(),
      prisma.playedGame.count({ where: { status: 'pending_approval' } }),
      prisma.playedGame.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          league: { select: { name: true } },
          submittedBy: { select: { email: true } },
        },
      }),
    ])

  const kpis = [
    { label: 'Gebruikers', value: userCount, icon: Users, href: '/admin/users' },
    { label: 'Gespeelde Partijen', value: playedGameCount, icon: Gamepad2, href: null },
    { label: 'Spelsjablonen', value: templateCount, icon: LayoutTemplate, href: null },
    { label: 'Competities', value: leagueCount, icon: Trophy, href: null },
    { label: 'Wachtend op goedkeuring', value: pendingCount, icon: Clock, href: '/admin/approvals' },
  ]

  return (
    <div>
      {/* Page heading */}
      <h1
        className="font-headline"
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.87)',
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}
      >
        Dashboard
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 32 }}>
        Overzicht van Dice Vault
      </p>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {kpis.map(({ label, value, icon: Icon, href }) => {
          const cardInner = (
            <>
              {/* Icon */}
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(74,142,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} style={{ color: '#4a8eff' }} />
              </div>

              {/* Label */}
              <span
                className="font-headline"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                {label}
              </span>

              {/* Value */}
              <span
                className="font-headline"
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.87)',
                  lineHeight: 1,
                }}
              >
                {value}
              </span>

              {href && (
                <span style={{ fontSize: 12, color: '#4a8eff', marginTop: 4 }}>
                  Bekijk &rarr;
                </span>
              )}
            </>
          )

          const cardStyle: React.CSSProperties = {
            background: '#161f28',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 20,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            textDecoration: 'none',
          }

          return href ? (
            <Link key={label} href={href} style={cardStyle}>
              {cardInner}
            </Link>
          ) : (
            <div key={label} style={cardStyle}>
              {cardInner}
            </div>
          )
        })}
      </div>

      {/* Recent activity */}
      <div
        style={{
          background: '#161f28',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2
            className="font-headline"
            style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}
          >
            Recente activiteit
          </h2>
        </div>

        {recentGames.length === 0 ? (
          <p style={{ padding: 24, color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
            Geen partijen gevonden.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {recentGames.map((game, i) => (
              <li
                key={game.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 24px',
                  borderBottom:
                    i < recentGames.length - 1
                      ? '1px solid rgba(255,255,255,0.05)'
                      : 'none',
                }}
              >
                {/* Date badge */}
                <div
                  style={{
                    minWidth: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.87)',
                      lineHeight: 1,
                    }}
                  >
                    {game.playedAt.getDate()}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.4)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {game.playedAt.toLocaleString('nl-NL', { month: 'short' })}
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.87)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {game.league.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {game.submittedBy.email}
                  </div>
                </div>

                {/* Status badge */}
                {game.status === 'pending_approval' && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#f59e0b',
                      background: 'rgba(245,158,11,0.12)',
                      borderRadius: 6,
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    In afwachting
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
