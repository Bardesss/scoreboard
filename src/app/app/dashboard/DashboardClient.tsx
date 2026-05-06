import { Avatar } from '@/components/shared/Avatar'
import { Card } from '@/components/stats/Card'
import { PaginatedGamesTable } from '@/components/stats/PaginatedGamesTable'
import { PanelHeader } from '@/components/stats/PanelHeader'
import { RankedListRow } from '@/components/stats/RankedListRow'
import { StatBar } from '@/components/stats/StatBar'
import { TransitionProvider, DimmedWhilePending } from '@/components/stats/TransitionDimmer'
import { DateFilter as DateFilterPanel } from '@/components/stats/DateFilter'
import type { StatsBundle, DateFilter } from '@/lib/stats/types'
import type { CompactGameRow, GamesPage } from '@/components/stats/PaginatedGamesTable'

// ─── Ranking panel ────────────────────────────────────────────────────────────

function RankingPanel({ ranking }: { ranking: StatsBundle['ranking'] }) {
  return (
    <Card>
      <PanelHeader title="🏆 Ranking" subtitle="alle leagues" />
      <div style={{ padding: '0 18px' }}>
        {ranking.map((p, i) => (
          <RankedListRow key={p.name} rank={i + 1} isLast={i === ranking.length - 1} highlighted={p.isCurrentUser}>
            <Avatar seed={p.avatarSeed} name={p.name} size={24} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: p.isCurrentUser ? 700 : 400, color: '#1e1a14', marginLeft: 8 }}>
              {p.name}
            </span>
            <span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>{p.wins} wins</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14' }}>{p.winRatio}%</span>
          </RankedListRow>
        ))}
        {ranking.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>}
      </div>
    </Card>
  )
}

// ─── Top games panel ──────────────────────────────────────────────────────────

function TopGamesPanel({ topGames }: { topGames: NonNullable<StatsBundle['topGames']> }) {
  return (
    <Card>
      <PanelHeader title="🎲 Top spellen" subtitle="meest gespeeld" />
      <div style={{ padding: '0 18px' }}>
        {topGames.map((g, i) => (
          <RankedListRow key={g.name} rank={i + 1} isLast={i === topGames.length - 1}>
            <span style={{ flex: 1, fontSize: 13, color: '#1e1a14' }}>{g.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14', marginRight: 10 }}>{g.count}×</span>
            <span style={{ fontSize: 12, color: '#6b5e4a' }}>
              {g.userWinRatio !== null ? `${g.userWinRatio}% wr` : '—'}
            </span>
          </RankedListRow>
        ))}
        {topGames.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>}
      </div>
    </Card>
  )
}

// ─── Play days panel ──────────────────────────────────────────────────────────

function PlayDaysPanel({ playDays }: { playDays: StatsBundle['playDays'] }) {
  const max = Math.max(...playDays.map(d => d.count), 1)
  return (
    <Card>
      <PanelHeader title="📅 Speeldagen" />
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {playDays.map((d, i) => (
          <StatBar
            key={d.day}
            label={d.label}
            trailingLabel={i === 0 && d.count > 0 ? ' 🔥' : ''}
            value={`${d.count} sessies`}
            ratio={d.count / max}
            highlighted={i === 0 && d.count > 0}
            dimmed={d.count === 0}
          />
        ))}
      </div>
    </Card>
  )
}

// ─── Leagues panel ────────────────────────────────────────────────────────────

function LeaguesPanel({ leagues }: { leagues: NonNullable<StatsBundle['leagues']> }) {
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
    <Card>
      <PanelHeader title="🏅 Leagues" subtitle="meest actief" />
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
        {leagues.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen leagues aangemaakt.</p>}
      </div>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  stats,
  gamesPage,
  filter,
  locale = 'nl',
}: {
  stats: StatsBundle
  gamesPage: GamesPage<CompactGameRow>
  filter: DateFilter
  locale?: 'nl' | 'en'
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    params.set('range', filter.range)
    if (filter.range === 'custom' && filter.from && filter.to) {
      params.set('from', filter.from.toISOString().slice(0, 10))
      params.set('to', filter.to.toISOString().slice(0, 10))
    }
    params.set('page', String(p))
    return `?${params.toString()}`
  }

  return (
    <TransitionProvider>
      <DateFilterPanel locale={locale} />
      <DimmedWhilePending>
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
          {stats.topGames && <TopGamesPanel topGames={stats.topGames} />}
          <PlayDaysPanel playDays={stats.playDays} />
          {stats.leagues && <LeaguesPanel leagues={stats.leagues} />}
        </div>

        {/* Paginated games table */}
        <PaginatedGamesTable
          variant="compact"
          page={gamesPage}
          buildHref={buildHref}
        />
      </DimmedWhilePending>
    </TransitionProvider>
  )
}
