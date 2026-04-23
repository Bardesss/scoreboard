import Link from 'next/link'
import { Avatar } from '@/components/shared/Avatar'
import type { DashboardStats, GamesPage } from './page'

// ─── Shared styles ────────────────────────────────────────────────────────────

const card = {
  background: '#fefcf8',
  border: '1px solid #c5b89f',
  borderRadius: 16,
  overflow: 'hidden' as const,
}

const cardHeader = {
  padding: '14px 18px',
  borderBottom: '1px solid #ede5d8',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
}

const cardTitle = {
  fontSize: 14,
  fontWeight: 700,
  color: '#1e1a14',
  fontFamily: 'var(--font-headline)',
}

const labelStyle = {
  fontSize: 11,
  color: '#6b5e4a',
}

// ─── Ranking panel ────────────────────────────────────────────────────────────

function RankingPanel({ ranking }: { ranking: DashboardStats['ranking'] }) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>🏆 Ranking</span>
        <span style={labelStyle}>alle leagues</span>
      </div>
      <div style={{ padding: '0 18px' }}>
        {ranking.map((p, i) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < ranking.length - 1 ? '1px solid #f2ece3' : undefined,
              ...(p.isCurrentUser
                ? { background: 'rgba(245,166,35,0.07)', margin: '0 -18px', padding: '8px 18px' }
                : {}),
            }}
          >
            <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: i < 3 ? '#f5a623' : '#9a8c7a', flexShrink: 0 }}>
              {i + 1}
            </span>
            <Avatar seed={p.avatarSeed} name={p.name} size={24} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: p.isCurrentUser ? 700 : 400, color: '#1e1a14', marginLeft: 8 }}>
              {p.name}
            </span>
            <span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>{p.wins} wins</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14' }}>{p.winRatio}%</span>
          </div>
        ))}
        {ranking.length === 0 && (
          <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>
        )}
      </div>
    </div>
  )
}

// ─── Top games panel ──────────────────────────────────────────────────────────

function TopGamesPanel({ topGames }: { topGames: DashboardStats['topGames'] }) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>🎲 Top spellen</span>
        <span style={labelStyle}>meest gespeeld</span>
      </div>
      <div style={{ padding: '0 18px' }}>
        {topGames.map((g, i) => (
          <div
            key={g.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < topGames.length - 1 ? '1px solid #f2ece3' : undefined,
            }}
          >
            <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: i < 3 ? '#f5a623' : '#9a8c7a', flexShrink: 0 }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, fontSize: 13, color: '#1e1a14' }}>{g.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14', marginRight: 10 }}>{g.count}×</span>
            <span style={{ fontSize: 12, color: '#6b5e4a' }}>
              {g.userWinRatio !== null ? `${g.userWinRatio}% wr` : '—'}
            </span>
          </div>
        ))}
        {topGames.length === 0 && (
          <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>
        )}
      </div>
    </div>
  )
}

// ─── Play days panel ──────────────────────────────────────────────────────────

function PlayDaysPanel({ playDays }: { playDays: DashboardStats['playDays'] }) {
  const max = Math.max(...playDays.map(d => d.count), 1)
  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>📅 Speeldagen</span>
      </div>
      <div style={{ padding: '16px 18px' }}>
        {playDays.map((d, i) => (
          <div key={d.day} style={{ marginBottom: i < playDays.length - 1 ? 11 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400, color: d.count === 0 ? '#9a8c7a' : '#1e1a14' }}>
                {d.label}{i === 0 && d.count > 0 ? ' 🔥' : ''}
              </span>
              <span style={{ fontSize: 12, color: d.count === 0 ? '#9a8c7a' : '#6b5e4a' }}>{d.count} sessies</span>
            </div>
            <div style={{ background: '#ede5d8', borderRadius: 4, height: 7 }}>
              <div
                style={{
                  background: i === 0 && d.count > 0 ? '#f5a623' : d.count === 0 ? '#dbd0bc' : '#c5b89f',
                  borderRadius: 4,
                  height: 7,
                  width: `${Math.round((d.count / max) * 100)}%`,
                  minWidth: d.count > 0 ? 4 : 0,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Leagues panel ────────────────────────────────────────────────────────────

function LeaguesPanel({ leagues }: { leagues: DashboardStats['leagues'] }) {
  function recency(iso: string | null): string {
    if (!iso) return 'nooit gespeeld'
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
    if (days === 0) return 'vandaag'
    if (days === 1) return 'gisteren'
    if (days < 7) return `${days} dagen geleden`
    if (days < 14) return '1 week geleden'
    if (days < 31) return `${Math.floor(days / 7)} weken geleden`
    return `${Math.floor(days / 30)} maanden geleden`
  }

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>🏅 Leagues</span>
        <span style={labelStyle}>meest actief</span>
      </div>
      <div style={{ padding: '0 18px' }}>
        {leagues.map((l, i) => (
          <div
            key={l.id}
            style={{
              padding: '11px 0',
              borderBottom: i < leagues.length - 1 ? '1px solid #f2ece3' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400, color: '#1e1a14' }}>{l.name}</div>
                <div style={{ fontSize: 12, color: '#6b5e4a', marginTop: 1 }}>
                  {l.playerCount} speler{l.playerCount !== 1 ? 's' : ''} · {recency(l.lastPlayedAt)}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: l.sessionCount === 0 ? '#9a8c7a' : '#1e1a14' }}>
                {l.sessionCount}×
              </span>
            </div>
          </div>
        ))}
        {leagues.length === 0 && (
          <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen leagues aangemaakt.</p>
        )}
      </div>
    </div>
  )
}

// ─── Games table ─────────────────────────────────────────────────────────────

function GamesTable({ gamesPage }: { gamesPage: GamesPage }) {
  const { games, page, totalPages, total } = gamesPage

  return (
    <div style={card}>
      <div style={{ ...cardHeader, padding: '14px 20px' }}>
        <span style={cardTitle}>Gespeelde partijen</span>
        <span style={labelStyle}>{total} totaal · pagina {page} van {totalPages}</span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 140px 90px',
          padding: '7px 20px',
          background: '#f2ece3',
        }}
      >
        {['Spel · League', 'Datum', 'Spelers', 'Uitslag'].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b5e4a' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {games.map((g, i) => (
        <div
          key={g.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 140px 90px',
            padding: '11px 20px',
            borderBottom: i < games.length - 1 ? '1px solid #f2ece3' : undefined,
            background: g.userWon === true ? 'rgba(245,166,35,0.04)' : undefined,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1a14' }}>{g.gameName}</div>
            <div style={{ fontSize: 11, color: '#6b5e4a' }}>{g.leagueName}</div>
          </div>
          <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>
            {new Date(g.playedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>
            {g.playerNames.join(', ')}
          </div>
          <div style={{ paddingTop: 1 }}>
            {g.userWon === true && (
              <span style={{ background: '#fff3d4', color: '#c27f0a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                Gewonnen
              </span>
            )}
            {g.userWon === false && (
              <span style={{ background: '#f2ece3', color: '#6b5e4a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                Verloren
              </span>
            )}
          </div>
        </div>
      ))}

      {games.length === 0 && (
        <p style={{ fontSize: 13, color: '#9a8c7a', padding: '20px', textAlign: 'center' }}>
          Nog geen partijen gespeeld.
        </p>
      )}

      {/* Pagination */}
      <div
        style={{
          padding: '11px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #ede5d8',
          background: '#f2ece3',
        }}
      >
        <span style={{ fontSize: 12, color: '#6b5e4a' }}>Pagina {page} van {totalPages} · 25 per pagina</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {page > 1 ? (
            <Link
              href={`?page=${page - 1}`}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', color: '#1e1a14', fontSize: 12, textDecoration: 'none' }}
            >
              ← Vorige
            </Link>
          ) : (
            <span style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', color: '#9a8c7a', fontSize: 12, opacity: 0.4 }}>
              ← Vorige
            </span>
          )}
          {page < totalPages ? (
            <Link
              href={`?page=${page + 1}`}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #f5a623', background: '#fff3d4', color: '#c27f0a', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              Volgende →
            </Link>
          ) : (
            <span style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', color: '#9a8c7a', fontSize: 12, opacity: 0.4 }}>
              Volgende →
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  stats,
  gamesPage,
}: {
  stats: DashboardStats
  gamesPage: GamesPage
}) {
  return (
    <>
      {/* 2×2 panel grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
        className="sm:grid-cols-2 grid-cols-1"
      >
        <RankingPanel ranking={stats.ranking} />
        <TopGamesPanel topGames={stats.topGames} />
        <PlayDaysPanel playDays={stats.playDays} />
        <LeaguesPanel leagues={stats.leagues} />
      </div>

      {/* Paginated games table */}
      <GamesTable gamesPage={gamesPage} />
    </>
  )
}
