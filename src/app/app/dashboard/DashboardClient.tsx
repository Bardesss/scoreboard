import { Avatar } from '@/components/shared/Avatar'
import { Card } from '@/components/stats/Card'
import { PaginatedGamesTable } from '@/components/stats/PaginatedGamesTable'
import { PanelHeader } from '@/components/stats/PanelHeader'
import { RankedListRow } from '@/components/stats/RankedListRow'
import { StatBar } from '@/components/stats/StatBar'
import { TransitionProvider, DimmedWhilePending } from '@/components/stats/TransitionDimmer'
import { DateFilter as DateFilterPanel } from '@/components/stats/DateFilter'
import { MissionChart } from '@/components/stats/MissionChart'
import { GamesFrequencyChart } from '@/components/stats/GamesFrequencyChart'
import { AnimatedNumber } from '@/components/stats/AnimatedNumber'
import type { StatsBundle, DateFilter } from '@/lib/stats/types'
import type { CompactGameRow, GamesPage } from '@/components/stats/PaginatedGamesTable'
import type { StatsLabels, StatsFormatters } from '@/lib/stats/buildStatsLabels'

// ─── Recency helper ───────────────────────────────────────────────────────────

function recency(iso: string | null, labels: StatsLabels, formatters: StatsFormatters): string {
  if (!iso) return labels.recencyNever
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return labels.recencyToday
  if (days === 1) return labels.recencyYesterday
  if (days < 7) return formatters.recencyDays(days)
  if (days < 14) return labels.recencyOneWeek
  if (days < 31) return formatters.recencyWeeks(Math.floor(days / 7))
  return formatters.recencyMonths(Math.floor(days / 30))
}

// ─── Ranking panel ────────────────────────────────────────────────────────────

function RankingPanel({
  ranking,
  index,
  labels,
  formatters,
}: {
  ranking: StatsBundle['ranking']
  index?: number
  labels: StatsLabels
  formatters: StatsFormatters
}) {
  return (
    <Card index={index}>
      <PanelHeader title={`🏆 ${labels.ranking}`} subtitle={labels.rankingSubtitle} />
      <div style={{ padding: '0 18px' }}>
        {ranking.map((p, i) => (
          <RankedListRow key={p.name} rank={i + 1} isLast={i === ranking.length - 1} highlighted={p.isCurrentUser}>
            <Avatar seed={p.avatarSeed} name={p.name} size={24} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: p.isCurrentUser ? 700 : 400, color: '#1e1a14', marginLeft: 8 }}>
              {p.name}
            </span>
            <span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>
              {i === 0 ? (
                (() => {
                  const full = formatters.wins(p.wins)
                  const idx = full.indexOf(String(p.wins))
                  if (idx < 0) return full
                  const before = full.slice(0, idx)
                  const after = full.slice(idx + String(p.wins).length)
                  return <>{before}<AnimatedNumber value={p.wins} />{after}</>
                })()
              ) : formatters.wins(p.wins)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14' }}>{formatters.winRatio(p.winRatio)}</span>
          </RankedListRow>
        ))}
        {ranking.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>{labels.empty}</p>}
      </div>
    </Card>
  )
}

// ─── Top games panel ──────────────────────────────────────────────────────────

function TopGamesPanel({
  topGames,
  index,
  labels,
  formatters,
}: {
  topGames: NonNullable<StatsBundle['topGames']>
  index?: number
  labels: StatsLabels
  formatters: StatsFormatters
}) {
  return (
    <Card index={index}>
      <PanelHeader title={`🎲 ${labels.topGames}`} subtitle={labels.topGamesSubtitle} />
      <div style={{ padding: '0 18px' }}>
        {topGames.map((g, i) => (
          <RankedListRow key={g.name} rank={i + 1} isLast={i === topGames.length - 1}>
            <span style={{ flex: 1, fontSize: 13, color: '#1e1a14' }}>{g.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14', marginRight: 10 }}>{formatters.playCount(g.count)}</span>
            <span style={{ fontSize: 12, color: '#6b5e4a' }}>
              {g.userWinRatio !== null ? `${g.userWinRatio}% wr` : '—'}
            </span>
          </RankedListRow>
        ))}
        {topGames.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>{labels.empty}</p>}
      </div>
    </Card>
  )
}

// ─── Play days panel ──────────────────────────────────────────────────────────

function PlayDaysPanel({
  playDays,
  index,
  labels,
  formatters,
}: {
  playDays: StatsBundle['playDays']
  index?: number
  labels: StatsLabels
  formatters: StatsFormatters
}) {
  const max = Math.max(...playDays.map(d => d.count), 1)
  return (
    <Card index={index}>
      <PanelHeader title={`📅 ${labels.playDays}`} />
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {playDays.map((d, i) => (
          <StatBar
            key={d.day}
            label={d.label}
            trailingLabel={i === 0 && d.count > 0 ? ' 🔥' : ''}
            value={formatters.playCountSessies(d.count)}
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

function LeaguesPanel({
  leagues,
  index,
  labels,
  formatters,
}: {
  leagues: NonNullable<StatsBundle['leagues']>
  index?: number
  labels: StatsLabels
  formatters: StatsFormatters
}) {
  return (
    <Card index={index}>
      <PanelHeader title={`🏅 ${labels.leaguesPanel}`} subtitle={labels.leaguesSubtitle} />
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
                  {formatters.playerCount(l.playerCount)} · {recency(l.lastPlayedAt, labels, formatters)}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: l.sessionCount === 0 ? '#9a8c7a' : '#1e1a14' }}>
                {formatters.playCount(l.sessionCount)}
              </span>
            </div>
          </div>
        ))}
        {leagues.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>{labels.emptyLeagues}</p>}
      </div>
    </Card>
  )
}

// ─── Missions panel ───────────────────────────────────────────────────────────

function MissionsPanel({
  missions,
  index,
  labels,
  formatters,
}: {
  missions: NonNullable<StatsBundle['missions']>
  index?: number
  labels: StatsLabels
  formatters: StatsFormatters
}) {
  return (
    <Card index={index}>
      <PanelHeader title={`🎯 ${labels.missions}`} subtitle={formatters.missionsTop(missions[0].count)} />
      <MissionChart missions={missions} />
    </Card>
  )
}

// ─── Games frequency panel ────────────────────────────────────────────────────

function GamesFrequencyPanel({
  buckets,
  index,
  labels,
  formatters,
}: {
  buckets: StatsBundle['gamesFrequency']
  index?: number
  labels: StatsLabels
  formatters: StatsFormatters
}) {
  const total = buckets.reduce((s, b) => s + b.count, 0)
  return (
    <Card index={index}>
      <PanelHeader title={`📈 ${labels.gamesFrequency}`} subtitle={total > 0 ? formatters.totalPrefix(total) : undefined} />
      <GamesFrequencyChart buckets={buckets} />
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  stats,
  gamesPage,
  filter,
  locale = 'nl',
  labels,
  formatters,
}: {
  stats: StatsBundle
  gamesPage: GamesPage<CompactGameRow>
  filter: DateFilter
  locale?: 'nl' | 'en'
  labels: StatsLabels
  formatters: StatsFormatters
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
      <DateFilterPanel labels={labels} />
      <DimmedWhilePending>
        {/* Panel grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 14,
            marginBottom: 20,
          }}
          className="sm:grid-cols-2 grid-cols-1"
        >
          <RankingPanel ranking={stats.ranking} index={0} labels={labels} formatters={formatters} />
          {stats.topGames && <TopGamesPanel topGames={stats.topGames} index={1} labels={labels} formatters={formatters} />}
          <PlayDaysPanel playDays={stats.playDays} index={2} labels={labels} formatters={formatters} />
          {stats.leagues && <LeaguesPanel leagues={stats.leagues} index={3} labels={labels} formatters={formatters} />}
          {stats.missions && <MissionsPanel missions={stats.missions} index={4} labels={labels} formatters={formatters} />}
          <GamesFrequencyPanel buckets={stats.gamesFrequency} index={5} labels={labels} formatters={formatters} />
        </div>

        {/* Paginated games table */}
        <PaginatedGamesTable
          variant="compact"
          page={gamesPage}
          buildHref={buildHref}
          labels={labels}
          formatters={formatters}
          locale={locale}
        />
      </DimmedWhilePending>
    </TransitionProvider>
  )
}
