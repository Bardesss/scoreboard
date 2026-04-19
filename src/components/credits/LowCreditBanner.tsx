import Link from 'next/link'

export function LowCreditBanner({ locale }: { locale: string }) {
  const isNl = locale === 'nl'
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 lg:left-64 flex items-center justify-between px-4 py-2"
      style={{ background: '#c47f00', color: '#fff' }}
    >
      <span className="font-headline font-semibold text-xs">
        {isNl ? 'Je credits raken op. Koop meer om te blijven spelen.' : "You're running low on credits. Buy more to keep playing."}
      </span>
      <Link
        href="/app/credits"
        className="px-3 py-1 rounded-lg font-headline font-bold text-xs flex-shrink-0 ml-4"
        style={{ background: 'rgba(255,255,255,0.2)' }}
      >
        {isNl ? 'Credits kopen' : 'Buy Credits'}
      </Link>
    </div>
  )
}
