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
import type { StatsLabels, StatsFormatters } from '@/lib/stats/buildStatsLabels'

export function LeagueStatsClient({
  stats,
  gamesPage,
  filter,
  locale,
  memberCount,
  renderRowActions,
  labels,
  formatters,
}: {
  stats: StatsBundle
  gamesPage: GamesPage<VerboseGameRow>
  filter: DateFilter
  locale: 'nl' | 'en'
  memberCount: number
  renderRowActions?: (row: VerboseGameRow) => React.ReactNode
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

  let idx = 0
  const nextIdx = () => idx++

  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'

  return (
    <TransitionProvider>
      <DateFilterPanel labels={labels} />
      <DimmedWhilePending>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}
          className="sm:grid-cols-2 grid-cols-1"
        >
          <RankingCard ranking={stats.ranking} index={nextIdx()} labels={labels} formatters={formatters} />

          {memberCount > 8 ? (
            <Card index={nextIdx()}>
              <PanelHeader title={`🤝 ${labels.headToHead}`} />
              <p style={{ padding: '16px 18px', fontSize: 13, color: '#9a8c7a' }}>
                {labels.headToHeadTooMany}
              </p>
            </Card>
          ) : stats.headToHead ? (
            <Card index={nextIdx()}>
              <PanelHeader title={`🤝 ${labels.headToHead}`} />
              <HeadToHeadGrid matrix={stats.headToHead} />
            </Card>
          ) : null}

          <PlayDaysCard playDays={stats.playDays} index={nextIdx()} labels={labels} formatters={formatters} />

          {stats.missions && (
            <Card index={nextIdx()}>
              <PanelHeader title={`🎯 ${labels.missions}`} subtitle={formatters.missionsTop(stats.missions[0].count)} />
              <MissionChart missions={stats.missions} />
            </Card>
          )}

          {stats.streaks && stats.streaks.length > 0 && (
            <Card index={nextIdx()}>
              <PanelHeader title={`🔥 ${labels.streaks}`} />
              <div style={{ padding: '0 18px' }}>
                {stats.streaks.map((s, i) => {
                  const currentText = formatters.streaksCurrent(s.currentStreak)
                  const longestText = formatters.streaksLongest(s.longestStreak)
                  const splitWithAnim = (full: string, value: number) => {
                    const idx = full.indexOf(String(value))
                    if (idx < 0) return <>{full}</>
                    return <>{full.slice(0, idx)}<AnimatedNumber value={value} />{full.slice(idx + String(value).length)}</>
                  }
                  return (
                    <div key={s.playerId} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: i < stats.streaks!.length - 1 ? '1px solid #f2ece3' : undefined }}>
                      <Avatar seed={s.avatarSeed} name={s.name} size={24} />
                      <span style={{ flex: 1, fontSize: 13, marginLeft: 8 }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: s.currentStreak >= 2 ? '#c27f0a' : '#6b5e4a', marginRight: 10, fontWeight: s.currentStreak >= 2 ? 700 : 400 }}>
                        {i === 0 ? splitWithAnim(currentText, s.currentStreak) : currentText}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        {i === 0 ? splitWithAnim(longestText, s.longestStreak) : longestText}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {stats.recentForm && (
            <Card index={nextIdx()}>
              <PanelHeader title={`📊 ${labels.recentForm}`} />
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
                        ? <span style={{ fontSize: 11, color: '#9a8c7a' }}>{labels.recentFormNone}</span>
                        : r.results.map((res, j) => (
                            <span key={j} style={{
                              display: 'inline-block', minWidth: 18, textAlign: 'center',
                              padding: '1px 4px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                              background: res === 'W' ? '#fff3d4' : '#f2ece3',
                              color: res === 'W' ? '#c27f0a' : '#6b5e4a',
                            }}>{res === 'W' ? labels.recentFormWon : labels.recentFormLost}</span>
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
              <PanelHeader title={`🏆 ${labels.scoreRecords}`} />
              <div style={{ padding: '0 18px' }}>
                {[
                  { label: labels.scoreRecordsHighest, data: stats.scoreRecords.highest, tone: 'amber' as const },
                  { label: labels.scoreRecordsHighestLoss, data: stats.scoreRecords.highestLoss, tone: 'muted' as const },
                ].map((row, i) => row.data && (
                  <div key={row.label} style={{ display: 'flex', padding: '9px 0', borderBottom: '1px solid #f2ece3', alignItems: 'baseline' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#6b5e4a' }}>{row.label}</span>
                    <span style={{ fontSize: 13, color: '#1e1a14', marginRight: 10 }}>{row.data.playerName}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: row.tone === 'amber' ? '#c27f0a' : '#1e1a14', marginRight: 10 }}>
                      {i === 0 ? <AnimatedNumber value={row.data.score} /> : row.data.score}
                    </span>
                    <span style={{ fontSize: 11, color: '#9a8c7a' }}>
                      {new Date(row.data.playedAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
                {stats.scoreRecords.averageWinner !== null && (
                  <div style={{ display: 'flex', padding: '9px 0' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#6b5e4a' }}>{labels.scoreRecordsAvgWinner}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{stats.scoreRecords.averageWinner}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {stats.winTrend && (
            <Card index={nextIdx()}>
              <PanelHeader title={`📉 ${labels.winTrend}`} subtitle={labels.winTrendSubtitle} />
              <WinTrendChart series={stats.winTrend} />
            </Card>
          )}

          <Card index={nextIdx()}>
            <PanelHeader
              title={`📈 ${labels.gamesFrequency}`}
              subtitle={stats.gamesFrequency.length > 0 ? formatters.totalPrefix(stats.gamesFrequency.reduce((s, b) => s + b.count, 0)) : undefined}
            />
            <GamesFrequencyChart buckets={stats.gamesFrequency} />
          </Card>
        </div>

        <PaginatedGamesTable
          variant="verbose"
          page={gamesPage}
          buildHref={buildHref}
          renderRowActions={renderRowActions}
          labels={labels}
          formatters={formatters}
          locale={locale}
        />
      </DimmedWhilePending>
    </TransitionProvider>
  )
}

function RankingCard({
  ranking,
  index,
  labels,
  formatters,
}: {
  ranking: StatsBundle['ranking']
  index: number
  labels: StatsLabels
  formatters: StatsFormatters
}) {
  return (
    <Card index={index}>
      <PanelHeader title={`🏆 ${labels.ranking}`} subtitle={labels.rankingMembers} />
      <div style={{ padding: '0 18px' }}>
        {ranking.map((p, i) => {
          const winsText = formatters.wins(p.wins)
          const splitWithAnim = (full: string, value: number) => {
            const idx = full.indexOf(String(value))
            if (idx < 0) return <>{full}</>
            return <>{full.slice(0, idx)}<AnimatedNumber value={value} />{full.slice(idx + String(value).length)}</>
          }
          return (
            <RankedListRow key={p.playerId} rank={i + 1} isLast={i === ranking.length - 1} highlighted={p.isCurrentUser}>
              <Avatar seed={p.avatarSeed} name={p.name} size={24} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: p.isCurrentUser ? 700 : 400, color: '#1e1a14', marginLeft: 8 }}>{p.name}</span>
              <span style={{ fontSize: 12, color: '#6b5e4a', marginRight: 10 }}>
                {i === 0 ? splitWithAnim(winsText, p.wins) : winsText}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1e1a14' }}>{formatters.winRatio(p.winRatio)}</span>
            </RankedListRow>
          )
        })}
        {ranking.length === 0 && <p style={{ fontSize: 13, color: '#9a8c7a', padding: '16px 0' }}>{labels.empty}</p>}
      </div>
    </Card>
  )
}

function PlayDaysCard({
  playDays,
  index,
  labels,
  formatters,
}: {
  playDays: StatsBundle['playDays']
  index: number
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
