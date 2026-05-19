'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Share2, QrCode, Settings, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { QRCodeCanvas } from './QRCode'
import { Scorecard } from '@/components/social/Scorecard'
import type { FeedPage } from '@/lib/social/loadFeed'

type Props = {
  email: string
  username: string | null
  signupMonth: string
  publicProfileMode: 'private' | 'stats' | 'full'
  connectUrl: string
  connections: { email: string; username: string | null }[]
  feed: FeedPage
  focusGameId: string | null
}

export function ProfileClient(props: Props) {
  const t = useTranslations('app.social')
  const tp = useTranslations('app.profile')
  const locale = useLocale() as 'nl' | 'en'
  const [qrOpen, setQrOpen] = useState(false)
  const focusRef = useRef<HTMLDivElement>(null)
  const displayName = props.username ?? props.email

  useEffect(() => {
    if (props.focusGameId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [props.focusGameId])

  async function handleShare() {
    const shareData = {
      title: tp('shareTitle'),
      text: `${tp('shareText')} ${props.connectUrl}`,
      url: props.connectUrl,
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share(shareData); return }
      catch (err) { if ((err as Error).name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(props.connectUrl); toast.success(tp('linkCopied')) }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${tp('shareText')} ${props.connectUrl}`)}`, '_blank') }
  }

  const privacyChipLabel =
    props.publicProfileMode === 'full' ? `${t('publicProfileMasterToggle')} (${t('publicProfileModeFull')})`
    : props.publicProfileMode === 'stats' ? `${t('publicProfileMasterToggle')} (${t('publicProfileModeStats')})`
    : t('privacyChipPrivate')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Identity card */}
      <section style={{ background: '#fefcf8', border: '1px solid #e8e1d8', borderRadius: 24, padding: 20 }}>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 44, height: 44, borderRadius: '50%', background: '#f5a623', color: '#fefcf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 18,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: 'var(--font-headline)', fontWeight: 900, fontSize: 18, color: '#1e1a14' }}>
              {displayName}
            </p>
            <p style={{ fontSize: 11, color: '#9a8878' }}>
              {props.username && `@${props.username} · `}
              {new Date(props.signupMonth).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Link
            href="/app/settings#privacy"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 999,
              background: props.publicProfileMode === 'private' ? '#f7f2e8' : '#fff3d4',
              color: props.publicProfileMode === 'private' ? '#6b5e4a' : '#c27f0a',
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
            }}
          >
            {privacyChipLabel}
          </Link>
          <button onClick={() => setQrOpen(true)} aria-label="QR" style={chipBtnStyle}>
            <QrCode size={14} />
          </button>
          <Link href="/app/settings" aria-label="Settings" style={{ ...chipBtnStyle, color: '#6b5e4a' }}>
            <Settings size={14} />
          </Link>
        </div>
      </section>

      {/* QR sheet */}
      {qrOpen && (
        <div
          role="dialog"
          onClick={() => setQrOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(30,26,20,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fefcf8', borderRadius: 24, padding: 24, maxWidth: 320, width: '100%' }}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 14, color: '#1e1a14' }}>
                {tp('shareTitle')}
              </span>
              <button onClick={() => setQrOpen(false)} aria-label="Close"><X size={18} color="#6b5e4a" /></button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <QRCodeCanvas value={props.connectUrl} />
              <button onClick={handleShare} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-headline font-bold text-sm" style={{ background: '#f5a623', color: '#1c1408' }}>
                <Share2 size={15} /> {tp('share')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity feed */}
      <section ref={focusRef}>
        <h2 style={{ fontFamily: 'var(--font-headline)', fontWeight: 700, fontSize: 13, color: '#9a8878', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          {t('feedHeading')}
        </h2>
        {props.feed.games.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9a8c7a', textAlign: 'center', padding: '20px' }}>{t('feedEmpty')}</p>
        ) : (
          <>
            <div className="space-y-3">
              {props.feed.games.map(g => (
                <Scorecard key={g.id} game={g} canReact locale={locale} />
              ))}
            </div>
            {props.feed.totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                {props.feed.page > 1
                  ? <Link href={`/app/profile?page=${props.feed.page - 1}`} aria-label="Previous page" style={pagerStyle}><ChevronLeft size={14} /></Link>
                  : <span />}
                <span style={{ fontSize: 12, color: '#9a8878' }}>{props.feed.page} / {props.feed.totalPages}</span>
                {props.feed.page < props.feed.totalPages
                  ? <Link href={`/app/profile?page=${props.feed.page + 1}`} aria-label="Next page" style={pagerStyle}><ChevronRight size={14} /></Link>
                  : <span />}
              </div>
            )}
          </>
        )}
      </section>

      {/* Connections section (preserve from old client) */}
      {props.connections.length > 0 && (
        <section>
          <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{tp('connections')}</h2>
          <ul className="space-y-2">
            {props.connections.map(c => (
              <li key={c.email} className="px-4 py-3 rounded-2xl font-headline font-semibold text-sm" style={{ background: '#fefcf8', border: '1px solid #e8e1d8', color: '#1e1a14' }}>
                {c.username ?? c.email}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const chipBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: '50%',
  background: '#f7f2e8', border: 'none', cursor: 'pointer',
  color: '#1e1a14',
}

const pagerStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8,
  border: '1px solid #c5b89f', background: '#fefcf8',
  fontSize: 12, fontWeight: 600, color: '#1e1a14', textDecoration: 'none',
}
