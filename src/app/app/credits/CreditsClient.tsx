'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Gift, ShoppingCart, ArrowDownCircle, ArrowUpCircle, Infinity as InfinityIcon } from 'lucide-react'
import { redeemDiscountCode } from './actions'

type Transaction = {
  id: string
  delta: number
  pool: string
  reason: string
  meta: Record<string, unknown> | null
  createdAt: string
}

export function CreditsClient({
  monthlyCredits,
  permanentCredits,
  isLifetimeFree,
  transactions,
  page,
  totalPages,
  locale,
}: {
  monthlyCredits: number
  permanentCredits: number
  isLifetimeFree: boolean
  transactions: Transaction[]
  page: number
  totalPages: number
  locale: 'nl' | 'en'
}) {
  const t = useTranslations('app.credits')
  const tReasons = useTranslations('app.credits.reasons')
  const tPools = useTranslations('app.credits.pools')

  const [code, setCode] = useState('')
  const [pending, startTransition] = useTransition()

  function reasonLabel(tx: Transaction): string {
    const known = ['game_template', 'league', 'add_player', 'played_game', 'discount_code', 'monthly_reset', 'purchase', 'admin_adjustment']
    if (known.includes(tx.reason)) return tReasons(tx.reason)
    return tx.reason
  }

  function metaSuffix(tx: Transaction): string | null {
    if (tx.reason === 'discount_code' && typeof tx.meta?.code === 'string') return tx.meta.code
    return null
  }

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || pending) return
    startTransition(async () => {
      const res = await redeemDiscountCode(code)
      if ('success' in res) {
        toast.success(t('discountRedeemed', { credits: res.creditsAdded }))
        setCode('')
        return
      }
      const errs: Record<string, string> = {
        notFound: t('discountErrorNotFound'),
        inactive: t('discountErrorInactive'),
        expired: t('discountErrorExpired'),
        exhausted: t('discountErrorExhausted'),
        alreadyRedeemed: t('discountErrorAlreadyRedeemed'),
        percentNotSupported: t('discountErrorPercentNotSupported'),
        unknown: t('discountErrorUnknown'),
      }
      toast.error(errs[res.error] ?? errs.unknown)
    })
  }

  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-GB'
  const total = monthlyCredits + permanentCredits

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Balance card */}
      <section className="rounded-2xl p-5" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <h2 className="font-headline font-bold text-xs uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>
          {t('balanceHeading')}
        </h2>
        {isLifetimeFree ? (
          <div className="flex items-center gap-3">
            <InfinityIcon size={32} style={{ color: '#f5a623' }} />
            <div>
              <div className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('lifetimeFree')}</div>
              <div className="font-body text-xs" style={{ color: '#9a8878' }}>{t('lifetimeFreeHint')}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="font-headline font-black mb-3" style={{ color: '#1c1810', fontSize: 36, lineHeight: 1 }}>
              {total} <span className="font-body font-normal text-sm" style={{ color: '#9a8878' }}>{t('balanceCredits')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.18)' }}>
                <div className="font-headline font-bold text-[11px] uppercase tracking-wide" style={{ color: '#9a8878' }}>{t('monthlyPool')}</div>
                <div className="font-headline font-bold text-lg" style={{ color: '#f5a623' }}>{monthlyCredits}</div>
                <div className="font-body text-[11px]" style={{ color: '#9a8878' }}>{t('monthlyHint')}</div>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(74,142,255,0.06)', border: '1px solid rgba(74,142,255,0.16)' }}>
                <div className="font-headline font-bold text-[11px] uppercase tracking-wide" style={{ color: '#9a8878' }}>{t('permanentPool')}</div>
                <div className="font-headline font-bold text-lg" style={{ color: '#4a8eff' }}>{permanentCredits}</div>
                <div className="font-body text-[11px]" style={{ color: '#9a8878' }}>{t('permanentHint')}</div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Buy CTA — placeholder until payment providers ship */}
      <section className="rounded-2xl p-5" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <h2 className="font-headline font-bold text-xs uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>
          {t('buyHeading')}
        </h2>
        <div className="flex items-center gap-3">
          <ShoppingCart size={20} style={{ color: '#9a8878' }} />
          <div className="flex-1">
            <div className="font-body text-sm" style={{ color: '#1c1810' }}>{t('buyComingSoon')}</div>
            <div className="font-body text-xs mt-0.5" style={{ color: '#9a8878' }}>{t('buyComingSoonHint')}</div>
          </div>
          <button
            type="button"
            disabled
            className="px-4 py-2 rounded-xl font-headline font-bold text-sm cursor-not-allowed"
            style={{ background: '#f0ebe3', color: '#9a8878' }}
          >
            {t('buyCta')}
          </button>
        </div>
      </section>

      {/* Discount code */}
      <section className="rounded-2xl p-5" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <h2 className="font-headline font-bold text-xs uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>
          {t('discountHeading')}
        </h2>
        <form onSubmit={handleRedeem} className="flex gap-2">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder={t('discountPlaceholder')}
            disabled={pending}
            className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm outline-none uppercase tracking-wide"
            style={{ background: '#f5f0e8', border: '1px solid #e8e1d8', color: '#1c1810' }}
          />
          <button
            type="submit"
            disabled={pending || !code.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-headline font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            <Gift size={15} /> {pending ? t('discountRedeeming') : t('discountRedeem')}
          </button>
        </form>
        <p className="font-body text-xs mt-2" style={{ color: '#9a8878' }}>{t('discountHint')}</p>
      </section>

      {/* Transactions */}
      <section className="rounded-2xl overflow-hidden" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f0ebe3' }}>
          <h2 className="font-headline font-bold text-xs uppercase tracking-wide" style={{ color: '#9a8878' }}>
            {t('historyHeading')}
          </h2>
          <span className="font-body text-xs" style={{ color: '#9a8878' }}>
            {t('historyPagination', { page, total: totalPages })}
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="font-body text-sm py-10 text-center" style={{ color: '#9a8878' }}>{t('historyEmpty')}</p>
        ) : (
          <ul>
            {transactions.map((tx, i) => {
              const positive = tx.delta > 0
              const suffix = metaSuffix(tx)
              return (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom: i < transactions.length - 1 ? '1px solid #f0ebe3' : undefined }}
                >
                  {positive
                    ? <ArrowUpCircle size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                    : <ArrowDownCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="font-body text-sm" style={{ color: '#1c1810' }}>
                      {reasonLabel(tx)}
                      {suffix && <span className="ml-1" style={{ color: '#9a8878' }}>· {suffix}</span>}
                    </div>
                    <div className="font-body text-xs mt-0.5" style={{ color: '#9a8878' }}>
                      {new Date(tx.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      <span className="ml-2">· {tPools(tx.pool)}</span>
                    </div>
                  </div>
                  <span className="font-headline font-bold text-sm flex-shrink-0" style={{ color: positive ? '#16a34a' : '#dc2626' }}>
                    {positive ? '+' : ''}{tx.delta}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #f0ebe3', background: '#fbf6ec' }}>
            {page > 1
              ? <Link href={`/app/credits?page=${page - 1}`} className="font-body text-xs" style={{ color: '#1c1810' }}>{t('paginationPrev')}</Link>
              : <span className="font-body text-xs" style={{ color: '#c4b79a' }}>{t('paginationPrev')}</span>
            }
            {page < totalPages
              ? <Link href={`/app/credits?page=${page + 1}`} className="font-body text-xs" style={{ color: '#1c1810' }}>{t('paginationNext')}</Link>
              : <span className="font-body text-xs" style={{ color: '#c4b79a' }}>{t('paginationNext')}</span>
            }
          </div>
        )}
      </section>
    </div>
  )
}
