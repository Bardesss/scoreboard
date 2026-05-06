import Link from 'next/link'
import type { StatsLabels, StatsFormatters } from '@/lib/stats/buildStatsLabels'

export type CompactGameRow = {
  id: string
  gameName: string
  leagueName: string
  playedAt: string
  playerNames: string[]
  userWon: boolean | null
}

export type VerboseGameRow = CompactGameRow & {
  scores: { playerName: string; score: number }[]
  notes: string | null
  shareToken: string | null
}

export type GamesPage<T> = {
  games: T[]
  total: number
  page: number
  totalPages: number
}

type SharedProps = {
  labels: StatsLabels
  formatters: StatsFormatters
  locale: 'nl' | 'en'
}

type Props =
  | ({ variant: 'compact'; page: GamesPage<CompactGameRow>; buildHref: (p: number) => string } & SharedProps)
  | ({ variant: 'verbose'; page: GamesPage<VerboseGameRow>; buildHref: (p: number) => string; renderRowActions?: (row: VerboseGameRow) => React.ReactNode } & SharedProps)

export function PaginatedGamesTable(props: Props) {
  const { page: gamesPage, buildHref, variant, labels, formatters, locale } = props
  const { games, page, totalPages, total } = gamesPage
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'

  return (
    <div style={{ background: '#fefcf8', border: '1px solid #c5b89f', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #ede5d8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14', fontFamily: 'var(--font-headline)' }}>
          {labels.gamesTable}
        </span>
        <span style={{ fontSize: 11, color: '#6b5e4a' }}>{formatters.gamesTableTotal(total, page, totalPages)}</span>
      </div>

      {variant === 'compact' ? <CompactHeader labels={labels} /> : null}

      {games.map((g, i) => variant === 'compact'
        ? <CompactRow key={g.id} row={g as CompactGameRow} isLast={i === games.length - 1} labels={labels} dateLocale={dateLocale} />
        : <VerboseRow key={g.id} row={g as VerboseGameRow} isLast={i === games.length - 1} renderActions={(props as Extract<Props, { variant: 'verbose' }>).renderRowActions} labels={labels} dateLocale={dateLocale} />
      )}

      {games.length === 0 && (
        <p style={{ fontSize: 13, color: '#9a8c7a', padding: '20px', textAlign: 'center' }}>{labels.gamesTableEmpty}</p>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} labels={labels} formatters={formatters} />
    </div>
  )
}

function CompactHeader({ labels }: { labels: StatsLabels }) {
  const headers = [
    labels.gamesTableHeaderGame,
    labels.gamesTableHeaderDate,
    labels.gamesTableHeaderPlayers,
    labels.gamesTableHeaderResult,
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 90px', padding: '7px 20px', background: '#f2ece3' }}>
      {headers.map(h => (
        <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b5e4a' }}>{h}</span>
      ))}
    </div>
  )
}

function CompactRow({
  row,
  isLast,
  labels,
  dateLocale,
}: {
  row: CompactGameRow
  isLast: boolean
  labels: StatsLabels
  dateLocale: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 120px 140px 90px',
        padding: '11px 20px',
        borderBottom: !isLast ? '1px solid #f2ece3' : undefined,
        background: row.userWon === true ? 'rgba(245,166,35,0.04)' : undefined,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1a14' }}>{row.gameName}</div>
        <div style={{ fontSize: 11, color: '#6b5e4a' }}>{row.leagueName}</div>
      </div>
      <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>
        {new Date(row.playedAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>{row.playerNames.join(', ')}</div>
      <div style={{ paddingTop: 1 }}>
        {row.userWon === true && <Badge text={labels.resultWon} tone="win" />}
        {row.userWon === false && <Badge text={labels.resultLost} tone="lose" />}
      </div>
    </div>
  )
}

function VerboseRow({
  row,
  isLast,
  renderActions,
  labels,
  dateLocale,
}: {
  row: VerboseGameRow
  isLast: boolean
  renderActions?: (row: VerboseGameRow) => React.ReactNode
  labels: StatsLabels
  dateLocale: string
}) {
  const d = new Date(row.playedAt)
  const time = d.getHours() !== 0 || d.getMinutes() !== 0 ? ` · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''
  const winner = row.scores[0]?.playerName
  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: !isLast ? '1px solid #f2ece3' : undefined,
        background: row.userWon === true ? 'rgba(245,166,35,0.04)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#6b5e4a', flex: 1 }}>
          {d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}{time}
        </span>
        {winner && (
          <span style={{ fontSize: 12, color: '#1e1a14' }}>
            <span style={{ color: '#6b5e4a' }}>{labels.gamesTableWinner}</span> <strong>{winner}</strong>
          </span>
        )}
        {row.notes && <span title={row.notes} aria-label={row.notes} style={{ fontSize: 12, color: '#6b5e4a' }}>📝</span>}
        {renderActions?.(row)}
      </div>
      <div style={{ fontSize: 12, color: '#4a3f2f' }}>
        {row.scores.map(s => `${s.playerName} ${s.score}`).join(' · ')}
      </div>
    </div>
  )
}

function Badge({ text, tone }: { text: string; tone: 'win' | 'lose' }) {
  const style = tone === 'win'
    ? { background: '#fff3d4', color: '#c27f0a' }
    : { background: '#f2ece3', color: '#6b5e4a' }
  return (
    <span style={{ ...style, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{text}</span>
  )
}

function Pagination({
  page,
  totalPages,
  buildHref,
  labels,
  formatters,
}: {
  page: number
  totalPages: number
  buildHref: (p: number) => string
  labels: StatsLabels
  formatters: StatsFormatters
}) {
  const base = { padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', fontSize: 12, textDecoration: 'none' } as const
  return (
    <div style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #ede5d8', background: '#f2ece3' }}>
      <span style={{ fontSize: 12, color: '#6b5e4a' }}>{formatters.pagination(page, totalPages)} · {formatters.paginationPerPage(25)}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {page > 1 ? (
          <Link href={buildHref(page - 1)} style={{ ...base, color: '#1e1a14' }}>{labels.prev}</Link>
        ) : (
          <span style={{ ...base, color: '#9a8c7a', opacity: 0.4 }}>{labels.prev}</span>
        )}
        {page < totalPages ? (
          <Link href={buildHref(page + 1)} style={{ ...base, color: '#c27f0a', borderColor: '#f5a623', background: '#fff3d4', fontWeight: 600 }}>{labels.next}</Link>
        ) : (
          <span style={{ ...base, color: '#9a8c7a', opacity: 0.4 }}>{labels.next}</span>
        )}
      </div>
    </div>
  )
}
