import Link from 'next/link'

export function LowCreditBanner({ message, buttonLabel }: { message: string; buttonLabel: string }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 lg:left-64 flex items-center justify-between px-4 py-2"
      style={{ background: '#c47f00', color: '#fff' }}
    >
      <span className="font-headline font-semibold text-xs">{message}</span>
      <Link
        href="/app/credits"
        className="px-3 py-1 rounded-lg font-headline font-bold text-xs flex-shrink-0 ml-4"
        style={{ background: 'rgba(255,255,255,0.2)' }}
      >
        {buttonLabel}
      </Link>
    </div>
  )
}
