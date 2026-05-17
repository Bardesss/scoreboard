'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { X, ChevronRight, Plus } from 'lucide-react'

export type LeagueOption = {
  id: string
  name: string
  gameTemplate: { icon: string; color: string }
  lastPlayedAt: string | null
}

type LogGameCtx = {
  isOpen: boolean
  open: () => void
  close: () => void
  leagueCount: number
}

const LogGameContext = createContext<LogGameCtx | null>(null)

export function useLogGame() {
  const ctx = useContext(LogGameContext)
  if (!ctx) throw new Error('useLogGame must be used inside LogGameProvider')
  return ctx
}

export function LogGameProvider({ leagues, children }: { leagues: LeagueOption[]; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const open = () => {
    if (leagues.length === 1) {
      router.push(`/app/leagues/${leagues[0].id}/log`)
      return
    }
    setIsOpen(true)
  }
  const close = () => setIsOpen(false)

  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [isOpen])

  return (
    <LogGameContext.Provider value={{ isOpen, open, close, leagueCount: leagues.length }}>
      {children}
      <LogGameSheet leagues={leagues} isOpen={isOpen} onClose={close} />
    </LogGameContext.Provider>
  )
}

function recencyLabel(iso: string | null, t: ReturnType<typeof useTranslations>): string {
  if (!iso) return t('neverPlayed')
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return t('playedToday')
  if (days === 1) return t('playedYesterday')
  if (days < 7) return t('playedDaysAgo', { count: days })
  if (days < 31) return t('playedWeeksAgo', { count: Math.floor(days / 7) })
  return t('playedMonthsAgo', { count: Math.floor(days / 30) })
}

function LogGameSheet({ leagues, isOpen, onClose }: { leagues: LeagueOption[]; isOpen: boolean; onClose: () => void }) {
  const t = useTranslations('app.logGame')

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sorted = [...leagues].sort((a, b) => {
    if (!a.lastPlayedAt && !b.lastPlayedAt) return a.name.localeCompare(b.name)
    if (!a.lastPlayedAt) return 1
    if (!b.lastPlayedAt) return -1
    return new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime()
  })

  const isEmpty = leagues.length === 0

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className="log-game-scrim"
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,10,5,0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logGameTitle"
        className="log-game-sheet"
        style={{ position: 'fixed', zIndex: 61, background: '#fefcf8', border: '1px solid #c5b89f', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #f2ece3', display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="logGameTitle" className="font-headline" style={{ fontSize: 18, fontWeight: 800, color: '#1e1a14', letterSpacing: '-0.01em' }}>
              {t('title')}
            </h2>
            <p style={{ fontSize: 13, color: '#6b5e4a', marginTop: 2 }}>{t('subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 999,
              border: '1px solid #e7dfd1', background: '#fefcf8',
              cursor: 'pointer', color: '#6b5e4a', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {isEmpty ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div
              aria-hidden
              style={{
                width: 56, height: 56, margin: '0 auto 14px',
                borderRadius: 16, background: '#fff3d4', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}
            >
              🎲
            </div>
            <h3 className="font-headline" style={{ fontSize: 15, fontWeight: 800, color: '#1e1a14' }}>{t('emptyTitle')}</h3>
            <p style={{ fontSize: 13, color: '#6b5e4a', marginTop: 4, marginBottom: 18 }}>{t('emptyBody')}</p>
            <Link
              href="/app/leagues/new"
              onClick={onClose}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 999,
                background: '#f5a623', color: '#1c1408',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(245,166,35,0.3)',
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              {t('emptyCta')}
            </Link>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0', overflowY: 'auto' }}>
            {sorted.map(l => (
              <li key={l.id}>
                <Link
                  href={`/app/leagues/${l.id}/log`}
                  onClick={onClose}
                  className="log-game-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 22px', textDecoration: 'none', color: '#1e1a14',
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: l.gameTemplate.color || '#fff3d4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, flexShrink: 0,
                    }}
                  >
                    {l.gameTemplate.icon || '🎲'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1a14', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#9a8c7a', marginTop: 1 }}>
                      {recencyLabel(l.lastPlayedAt, t)}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: '#c5b89f', flexShrink: 0 }} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
