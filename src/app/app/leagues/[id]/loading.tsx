import { StatsSkeleton } from '@/components/stats/StatsSkeleton'

export default function LeagueLoading() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="stats-skeleton-block" style={{ height: 28, width: 320, marginBottom: 8 }} />
      <div className="stats-skeleton-block" style={{ height: 12, width: 180, marginBottom: 24 }} />
      <StatsSkeleton panelCount={6} chart={false} />
    </div>
  )
}
