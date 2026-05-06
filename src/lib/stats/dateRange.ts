import type { DateFilter, Range } from './types'

const VALID_RANGES: Range[] = ['week', 'month', 'year', 'all', 'custom']

function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime())
}

function startOfISOWeekUTC(now: Date): Date {
  const d = new Date(now)
  const day = d.getUTCDay()
  const diff = (day + 6) % 7 // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function startOfMonthUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

function startOfYearUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
}

export function parseRange(searchParams: {
  range?: string
  from?: string
  to?: string
}): DateFilter {
  const raw = searchParams.range
  const range: Range = raw && (VALID_RANGES as string[]).includes(raw) ? (raw as Range) : 'all'
  const now = new Date()

  if (range === 'all') return { range: 'all', from: null, to: null }

  if (range === 'week') return { range: 'week', from: startOfISOWeekUTC(now), to: null }
  if (range === 'month') return { range: 'month', from: startOfMonthUTC(now), to: null }
  if (range === 'year') return { range: 'year', from: startOfYearUTC(now), to: null }

  // custom
  if (!searchParams.from || !searchParams.to) {
    return { range: 'all', from: null, to: null }
  }
  const from = new Date(`${searchParams.from}T00:00:00.000Z`)
  const to = new Date(`${searchParams.to}T23:59:59.999Z`)
  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return { range: 'all', from: null, to: null }
  }
  return { range: 'custom', from, to }
}

export function rangeToWhere(filter: DateFilter): { playedAt?: { gte?: Date; lte?: Date } } {
  if (!filter.from && !filter.to) return {}
  const w: { gte?: Date; lte?: Date } = {}
  if (filter.from) w.gte = filter.from
  if (filter.to) w.lte = filter.to
  return { playedAt: w }
}

export function cacheSuffix(filter: DateFilter): string | null {
  if (filter.range === 'custom') return null
  return filter.range
}
