export function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        padding: '14px 18px',
        borderBottom: '1px solid #ede5d8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14', fontFamily: 'var(--font-headline)' }}>
        {title}
      </span>
      {subtitle && <span style={{ fontSize: 11, color: '#6b5e4a' }}>{subtitle}</span>}
    </div>
  )
}
