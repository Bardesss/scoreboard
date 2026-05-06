import { Avatar } from '@/components/shared/Avatar'
import { Card } from '@/components/stats/Card'
import { PanelHeader } from '@/components/stats/PanelHeader'
import { RankedListRow } from '@/components/stats/RankedListRow'
import { StatBar } from '@/components/stats/StatBar'
import { HeadToHeadGrid } from '@/components/stats/HeadToHeadGrid'
import { MissionChart } from '@/components/stats/MissionChart'
import { WinTrendChart } from '@/components/stats/WinTrendChart'
import { GamesFrequencyChart } from '@/components/stats/GamesFrequencyChart'
import { AnimatedNumber } from '@/components/stats/AnimatedNumber'
import { DateFilter as DateFilterPanel } from '@/components/stats/DateFilter'
import { TransitionProvider, DimmedWhilePending } from '@/components/stats/TransitionDimmer'
import { PaginatedGamesTable, type VerboseGameRow, type GamesPage } from '@/components/stats/PaginatedGamesTable'
import type { StatsBundle, DateFilter } from '@/lib/stats/types'

export function LeagueStatsClient({
  stats,
  gamesPage,
  filter,
  locale,
  memberCount,
  renderRowActions,
}: {
  stats: StatsBundle
  gamesPage: GamesPage<VerboseGameRow>
  filter: DateFilter
  locale: 'nl' | 'en'
  memberCount: number
  renderRowActions?: (row: VerboseGameRow) => React.ReactNode
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

  let idx = 0
  const nextIdx = () => idx++

  return (
    <TransitionProvider>
      <DateFilterPanel locale={locale} />
      <DimmedWhilePending>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}
          className="sm:grid-cols-2 grid-cols-1"
        >
          <RankingCard ranking={stats.ranking} index={nextIdx()} />

          {memberCount > 8 ? (
            <Card index={nextIdx()}>
              <PanelHeader title="🤝 Onderlinge resultaten" />
              <p style={{ padding: '16px 18px', fontSize: 13, color: '#9a8c7a' }}>
                Te veel spelers voor head-to-head weergave.
              </p>
            </Card>
          ) : stats.headToHead ? (
            <Card index={nextIdx()}>
              <PanelHeader title="🤝 Onderlinge resultaten" />
              <HeadToHeadGrid matrix={stats.headToHead} />
            </Card>
          ) : null}

          <PlayDaysCard playDays={stats.playDays} index={nextIdx()} />

          {stats.missions && (
            <Card index={nextIdx()}>
              <PanelHeader title="🎯 Meest gewonnen missies" subtitle={`top: ${stats.missions[0].count}×`} />
              <MissionChart missions={stats.missions} />
            </Card>
          )}

          {stats.streaks && stats.streaks.length > 0 && (
            <Card index={nextIdx()}>
              <PanelHeader title="🔥 Winstreeks" />
              <div style={{ padding: '0 18px' }}>
                {stats.streaks.map((s, i) => (
                  <div key={s.playerId} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: i < stats.streaks!.length - 1 ? '1px solid #f2ece3' : undefined }}>
                    <Avatar seed={s.avatarSeed} name={s.name} size={24} />
                    <span style={{ flex: 1, fontSize: 13, marginLeft: 8 }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: s.currentStreak >= 2 ? '#c27f0a' : '#6b5e4a', marginRight: 10, fontWeight: s.currentStreak >= 2 ? 700 : 400 }}>
                      nu: {i === 0 ? <AnimatedNumber value={s.currentStreak} /> : s.currentStreak}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>langste: {i === 0 ? <AnimatedNumber value={s.longestStreak} /> : s.longestStreak}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {stats.recentForm && (
            <Card index={nextIdx()}>
              <PanelHeader title="📊 Recente vorm" />
              <div style={{ padding: '0 18px' }}>
                {stats.recentForm.map((r, i) => (
                  <div key={r.playerId} style={{
                    display: 'flex', alignItems: 'center', padding: '8px 0',
                    borderBottom: i < stats.recentForm!.length - 1 ? '1px solid #f2ece3' : undefined,
                    ...(r.isCurrentUser ? { background: 'rgba(245,166,35,0.07)', margin: '0 -18px', padding: '8px 18px' } : {}),
                  }}>
                    <Avatar seed={r.avatarSeed} name={r.name} size={22} />
                    <span style={{ flex: 1, fontSize: 13, marginLeft: 8, fontWeight: r.isCurrentUser ? 700 : 400 }}>{r.name}</span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {r.results.length === 0
                        ? <span style={{ fontSize: 11, color: '#9a8c7a' }}>geen partijen</span>
                        : r.results.map((res, j) => (
                            <span key={j} style={{
                              display: 'inline-block', minWidth: 18, textAlign: 'center',
                              padding: '1px 4px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                              background: res === 'W' ? '#fff3d4' : '#f2ece3',
                              color: res === 'W' ? '#c27f0a' : '#6b5e4a',
                            }}>{res}</span>
                          ))
                      }
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {stats.scoreRecords && (
            <Card index={nextIdx()}>
              <PanelHeader title="🏆 Recordscores" />
              <div style={{ padding: '0 18px' }}>
                {[
                  { label: 'Hoogste score ooit', data: stats.scoreRecords.highest, tone: 'amber' as const },
                  { label: 'Hoogste verliesscore', data: stats.scoreRecords.highestLoss, tone: 'muted' as const },
                ].map((row, i) => row.data && (
                  <div key={row.label} style={{ display: 'flex', padding: '9px 0', borderBottom: '1px solid #f2ece3', alignItems: 'baseline' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#6b5e4a' }}>{row.label}</span>
                    <span style={{ fontSize: 13, color: '#1e1a14', marginRight: 10 }}>{row.data.playerName}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: row.tone === 'amber' ? '#c27f0a' : '#1e1a14', marginRight: 10 }}>
                      {i === 0 ? <AnimatedNumber value={row.data.score} /> : row.data.score}
                    </span>
                    <span style={{ fontSize: 11, color: '#9a8c7a' }}>
                      {new Date(row.data.playedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
                {stats.scoreRecords.averageWinner !== null && (
                  <div style={{ display: 'flex', padding: '9px 0' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#6b5e4a' }}>Gemiddeld winnaar</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{stats.scoreRecords.averageWinner}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {stats.winTrend && (
            <Card index={nextIdx()}>
              <PanelHeader title="📉 Winst-trend" subtitle="cumulatief per speler" />
              <WinTrendChart series={stats.winTrend} />
            </Card>
          )}

          <Card index={nextIdx()}>
            <PanelHeader title="📈 Speelfrequentie" subtitle={stats.gamesFrequency.length > 0 ? `${stats.gamesFrequency.reduce((s, b) => s + b.count, 0)} partijen` : undefined} />
            <GamesFrequencyChart buckets={stats.gamesFrequency} />
          </Card>
        </div>

        <PaginatedGamesTable variant="verbose" page={gamesPage} buildHref={buildHref} renderRowActions={renderRowActions} />
      </DimmedWhilePending>
    </TransitionProvider>
  )
}

function RankingCard({ ranking, index }: { ranking: StatsBundle['ranking']; index: number }) {
  return (
    <Card index={index}>
      <PanelHeader title="🏆 Ranking" subtitle="alle leden" />
      <div style={{ padding: '0 18px' }}>
        {ranking.map((p, i) => (
          <RankedListRow key={p.playerId} rank={i + 1} isLast={i === ranking.length - 1} highlighted={p.isCurrentUser}>
            <Avatar seed={p.avatarSeed} name={p.name} size={24} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: p.isCurrentUser ? 700 : 400, color: '#1e1a14', marginLeft: 8 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>
              {i === 0 ? <><AnimatedNumber value={p.wins} /> wins</> : `${p.wins} wins`}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14' }}>{p.winRatio}%</span>
          </RankedListRow>
        ))}
        {ranking.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>Nog geen partijen gespeeld.</p>}
      </div>
    </Card>
  )
}

function PlayDaysCard({ playDays, index }: { playDays: StatsBundle['playDays']; index: number }) {
  const max = Math.max(...playDays.map(d => d.count), 1)
  return (
    <Card index={index}>
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
