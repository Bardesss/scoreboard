export type TemplatePlay = {
  templateId: string
  name: string
  color: string
  icon: string
  isWinner: boolean
}

export type TrophyEntry = {
  templateId: string
  name: string
  color: string
  icon: string
  plays: number
  winRate: number  // 0..1
}

export function computeTopThreeTemplates(plays: TemplatePlay[]): TrophyEntry[] {
  const buckets = new Map<string, { name: string; color: string; icon: string; plays: number; wins: number }>()
  for (const p of plays) {
    const cur = buckets.get(p.templateId) ?? { name: p.name, color: p.color, icon: p.icon, plays: 0, wins: 0 }
    cur.plays += 1
    if (p.isWinner) cur.wins += 1
    buckets.set(p.templateId, cur)
  }
  return Array.from(buckets.entries())
    .map(([templateId, v]) => ({
      templateId,
      name: v.name,
      color: v.color,
      icon: v.icon,
      plays: v.plays,
      winRate: v.plays === 0 ? 0 : v.wins / v.plays,
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 3)
}
