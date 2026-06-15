export default function TicketThreadLoading() {
  // Mirrors the thread layout: title + status, a few alternating message
  // bubbles, then the reply box. Overrides the support list skeleton so the
  // detail view doesn't flash a row list.
  const bubbles = [
    { align: 'flex-start', width: '70%', height: 64 },
    { align: 'flex-end', width: '55%', height: 48 },
    { align: 'flex-start', width: '78%', height: 80 },
  ] as const
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-5">
        <div className="stats-skeleton-block" style={{ height: 24, width: 260, borderRadius: 8 }} />
        <div className="stats-skeleton-block" style={{ height: 12, width: 80, marginTop: 10, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {bubbles.map((b, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: b.align }}>
            <div className="stats-skeleton-block" style={{ width: b.width, height: b.height, borderRadius: 12 }} />
          </div>
        ))}
      </div>
      <div className="stats-skeleton-block" style={{ height: 96, borderRadius: 12 }} />
    </div>
  )
}
