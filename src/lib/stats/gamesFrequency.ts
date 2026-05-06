import type { AggregatorGame, DateFilter, FrequencyBucket } from './types'

const TWO_MONTHS_MS = 62 * 86_400_000

function rangeSpanMs(filter: DateFilter, games: AggregatorGame[]): number {
  if (filter.from && filter.to) return filter.to.getTime() - filter.from.getTime()
  if (filter.from) return Date.now() - filter.from.getTime()
  if (games.length === 0) return 0
  const first = Math.min(...games.map(g => g.playedAt.getTime()))
  return Date.now() - first
}

function weekStartUTC(d: Date): Date {
  const day = d.getUTCDay()
  const diff = (day + 6) % 7
  const w = new Date(d)
  w.setUTCDate(w.getUTCDate() - diff)
  w.setUTCHours(0, 0, 0, 0)
  return w
}

function monthStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function computeGamesFrequency(games: AggregatorGame[], filter: DateFilter): FrequencyBucket[] {
  if (games.length === 0) return []
  const weekly = rangeSpanMs(filter, games) <= TWO_MONTHS_MS

  const buckets: Record<string, { count: number; start: Date }> = {}
  for (const g of games) {
    const start = weekly ? weekStartUTC(g.playedAt) : monthStartUTC(g.playedAt)
    const key = start.toISOString()
    if (!buckets[key]) buckets[key] = { count: 0, start }
    buckets[key].count++
  }

  const fmtWeek = (d: Date) => `${d.getUTCDate()} ${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][d.getUTCMonth()]}`
  const fmtMonth = (d: Date) => `${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`

  return Object.values(buckets)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(({ count, start }) => ({
      label: weekly ? fmtWeek(start) : fmtMonth(start),
      startISO: start.toISOString(),
      count,
    }))
}
