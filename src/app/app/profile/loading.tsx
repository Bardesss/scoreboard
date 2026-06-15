export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Identity card */}
      <div className="stats-skeleton-block" style={{ height: 132, borderRadius: 16 }} />
      {/* Secondary cards */}
      <div className="stats-skeleton-block" style={{ height: 180, borderRadius: 16 }} />
      <div className="stats-skeleton-block" style={{ height: 220, borderRadius: 16 }} />
    </div>
  )
}
