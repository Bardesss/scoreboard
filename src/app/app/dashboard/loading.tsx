import { StatsSkeleton } from '@/components/stats/StatsSkeleton'

export default function DashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div style={{ marginBottom: 24 }}>
        <div className="stats-skeleton-block" style={{ height: 24, width: 280, marginBottom: 4 }} />
        <div className="stats-skeleton-block" style={{ height: 12, width: 120 }} />
      </div>
      <StatsSkeleton panelCount={4} />
    </div>
  )
}
