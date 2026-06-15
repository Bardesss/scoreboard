type Props = {
  /** Number of placeholder rows to render. */
  rows?: number
  /** Show a subtitle shimmer under the title. */
  subtitle?: boolean
  /** Show a square button shimmer on the right of the header. */
  action?: boolean
  /** Row height in px (match the page's row density). */
  rowHeight?: number
  /** Gap between rows in px (match the page's space-y-* value). */
  gap?: number
}

/**
 * Generic loading skeleton for list/index pages: a PageHeader-shaped block
 * followed by rounded row placeholders. Reuses the globally-imported
 * `.stats-skeleton-block` shimmer so it matches the dashboard/league skeletons.
 * Render it inside the page's `max-w-4xl mx-auto py-8` wrapper.
 */
export function ListSkeleton({
  rows = 6,
  subtitle = false,
  action = false,
  rowHeight = 52,
  gap = 8,
}: Props) {
  return (
    <>
      <header className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0" style={{ flex: 1 }}>
          <div className="stats-skeleton-block" style={{ height: 28, width: 200, borderRadius: 8 }} />
          {subtitle && (
            <div className="stats-skeleton-block" style={{ height: 12, width: 280, marginTop: 10, borderRadius: 6 }} />
          )}
        </div>
        {action && (
          <div className="stats-skeleton-block" style={{ height: 40, width: 40, borderRadius: 12, flexShrink: 0 }} />
        )}
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="stats-skeleton-block" style={{ height: rowHeight, borderRadius: 16 }} />
        ))}
      </div>
    </>
  )
}
