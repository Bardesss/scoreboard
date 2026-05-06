import type { AggregatorGame, PlayDay } from './types'

const LOCALE_MAP: Record<string, string> = { nl: 'nl-NL', en: 'en-GB' }

export function computePlayDays(games: AggregatorGame[], locale: 'nl' | 'en'): PlayDay[] {
  const counts = new Array(7).fill(0) as number[]
  for (const g of games) counts[new Date(g.playedAt).getUTCDay()]++

  const fmt = new Intl.DateTimeFormat(LOCALE_MAP[locale] ?? 'en-GB', { weekday: 'long' })
  // Reference dates: 2026-04-19 is a Sunday (JS day 0).
  const reference = new Date('2026-04-19T12:00:00Z')

  return counts
    .map((count, day) => {
      const labelDate = new Date(reference)
      labelDate.setUTCDate(reference.getUTCDate() + day)
      const label = fmt.format(labelDate)
      return { day, label: label.charAt(0).toUpperCase() + label.slice(1), count }
    })
    .sort((a, b) => b.count - a.count)
}
