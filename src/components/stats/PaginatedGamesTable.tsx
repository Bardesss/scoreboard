import Link from 'next/link'

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

type Props =
  | { variant: 'compact'; page: GamesPage<CompactGameRow>; buildHref: (p: number) => string }
  | { variant: 'verbose'; page: GamesPage<VerboseGameRow>; buildHref: (p: number) => string; renderRowActions?: (row: VerboseGameRow) => React.ReactNode }

export function PaginatedGamesTable(props: Props) {
  const { page: gamesPage, buildHref, variant } = props
  const { games, page, totalPages, total } = gamesPage

  return (
    <div style={{ background: '#fefcf8', border: '1px solid #c5b89f', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #ede5d8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14', fontFamily: 'var(--font-headline)' }}>
          Gespeelde partijen
        </span>
        <span style={{ fontSize: 11, color: '#6b5e4a' }}>{total} totaal · pagina {page} van {totalPages}</span>
      </div>

      {variant === 'compact' ? <CompactHeader /> : null}

      {games.map((g, i) => variant === 'compact'
        ? <CompactRow key={g.id} row={g as CompactGameRow} isLast={i === games.length - 1} />
        : <VerboseRow key={g.id} row={g as VerboseGameRow} isLast={i === games.length - 1} renderActions={(props as Extract<Props, { variant: 'verbose' }>).renderRowActions} />
      )}

      {games.length === 0 && (
        <p style={{ fontSize: 13, color: '#9a8c7a', padding: '20px', textAlign: 'center' }}>Nog geen partijen gespeeld.</p>
      )}

      <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  )
}

function CompactHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 90px', padding: '7px 20px', background: '#f2ece3' }}>
      {['Spel · League', 'Datum', 'Spelers', 'Uitslag'].map(h => (
        <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b5e4a' }}>{h}</span>
      ))}
    </div>
  )
}

function CompactRow({ row, isLast }: { row: CompactGameRow; isLast: boolean }) {
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
        {new Date(row.playedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      <div style={{ fontSize: 13, color: '#6b5e4a', paddingTop: 1 }}>{row.playerNames.join(', ')}</div>
      <div style={{ paddingTop: 1 }}>
        {row.userWon === true && <Badge text="Gewonnen" tone="win" />}
        {row.userWon === false && <Badge text="Verloren" tone="lose" />}
      </div>
    </div>
  )
}

function VerboseRow({
  row,
  isLast,
  renderActions,
}: {
  row: VerboseGameRow
  isLast: boolean
  renderActions?: (row: VerboseGameRow) => React.ReactNode
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
          {d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}{time}
        </span>
        {winner && (
          <span style={{ fontSize: 12, color: '#1e1a14' }}>
            <span style={{ color: '#6b5e4a' }}>Winnaar:</span> <strong>{winner}</strong>
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

function Pagination({ page, totalPages, buildHref }: { page: number; totalPages: number; buildHref: (p: number) => string }) {
  const base = { padding: '5px 12px', borderRadius: 8, border: '1px solid #c5b89f', background: '#fefcf8', fontSize: 12, textDecoration: 'none' } as const
  return (
    <div style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #ede5d8', background: '#f2ece3' }}>
      <span style={{ fontSize: 12, color: '#6b5e4a' }}>Pagina {page} van {totalPages} · 25 per pagina</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {page > 1 ? (
          <Link href={buildHref(page - 1)} style={{ ...base, color: '#1e1a14' }}>← Vorige</Link>
        ) : (
          <span style={{ ...base, color: '#9a8c7a', opacity: 0.4 }}>← Vorige</span>
        )}
        {page < totalPages ? (
          <Link href={buildHref(page + 1)} style={{ ...base, color: '#c27f0a', borderColor: '#f5a623', background: '#fff3d4', fontWeight: 600 }}>Volgende →</Link>
        ) : (
          <span style={{ ...base, color: '#9a8c7a', opacity: 0.4 }}>Volgende →</span>
        )}
      </div>
    </div>
  )
}
