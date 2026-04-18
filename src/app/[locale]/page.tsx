import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import {
  Dices, BarChart2, Shield,
  Trophy, UserCheck, Share2, Bell,
  Vault, Users, ClipboardList, UserPlus,
  Building2, CreditCard, Zap,
} from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>> = {
  Dices, BarChart2, Shield, Trophy, UserCheck, Share2, Bell,
  Vault, Users, ClipboardList, UserPlus, Building2, CreditCard, Zap,
}

const DICE_PATTERNS: Record<number, number[]> = {
  1: [0,0,0, 0,1,0, 0,0,0],
  2: [1,0,0, 0,0,0, 0,0,1],
  3: [1,0,0, 0,1,0, 0,0,1],
  4: [1,0,1, 0,0,0, 1,0,1],
  5: [1,0,1, 0,1,0, 1,0,1],
  6: [1,0,1, 1,0,1, 1,0,1],
}

function DieFace({ value, size = 52, rotate = 0, opacity = 0.14 }: { value: 1|2|3|4|5|6; size?: number; rotate?: number; opacity?: number }) {
  const dots = DICE_PATTERNS[value]
  const dotSize = Math.round(size * 0.13)
  return (
    <div style={{
      width: size,
      height: size,
      border: `1.5px solid rgba(245,166,35,${opacity * 2.2})`,
      borderRadius: Math.round(size * 0.18),
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(3, 1fr)',
      padding: Math.round(size * 0.14),
      gap: Math.round(size * 0.07),
      opacity,
      transform: `rotate(${rotate}deg)`,
    }}>
      {dots.map((d, i) => (
        <div key={i} style={{
          borderRadius: '50%',
          background: d ? '#f5a623' : 'transparent',
          alignSelf: 'center',
          justifySelf: 'center',
          width: dotSize,
          height: dotSize,
        }} />
      ))}
    </div>
  )
}

function LPSectionHeader({ overline, headline, subheadline }: { overline: string; headline: string; subheadline?: string }) {
  return (
    <div className="text-center mb-12">
      <p className="font-headline font-black text-[10px] uppercase tracking-[.18em] mb-3" style={{ color: '#f5a623' }}>{overline}</p>
      <h2 className="font-headline font-black tracking-[-0.03em]" style={{ fontSize: 'clamp(28px,4vw,42px)', color: '#ede8dd' }}>{headline}</h2>
      {subheadline && <p className="font-body text-base mt-3 max-w-xl mx-auto" style={{ color: '#7a8799' }}>{subheadline}</p>}
    </div>
  )
}

const card = { background: '#141820', border: '1px solid rgba(245,166,35,0.08)' }
const amber = '#f5a623'
const text = '#ede8dd'
const muted = '#7a8799'
const dim = '#4a5568'

type Props = { params: Promise<{ locale: string }> }

export default async function LandingPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('landing')

  const features = [0, 1, 2].map(i => ({
    icon: t(`features.items.${i}.icon`),
    title: t(`features.items.${i}.title`),
    description: t(`features.items.${i}.description`),
  }))

  const howItWorksSteps = [0, 1, 2, 3].map(i => ({
    label: t(`howItWorks.steps.${i}.label`),
    icon: t(`howItWorks.steps.${i}.icon`),
    title: t(`howItWorks.steps.${i}.title`),
    description: t(`howItWorks.steps.${i}.description`),
  }))

  const groupItems = [0, 1, 2, 3].map(i => ({
    icon: t(`group.items.${i}.icon`),
    title: t(`group.items.${i}.title`),
    description: t(`group.items.${i}.description`),
  }))

  const creditCosts = [0, 1, 2, 3].map(i => ({
    action: t(`credits.costs.items.${i}.action`),
    cost: t(`credits.costs.items.${i}.cost`),
    icon: t(`credits.costs.items.${i}.icon`),
  }))

  const packs = [0, 1, 2, 3].map(i => ({
    credits: t(`packs.items.${i}.credits`),
    price: t(`packs.items.${i}.price`),
    tag: t(`packs.items.${i}.tag`),
  }))

  const paymentMethods = [0, 1, 2].map(i => ({
    title: t(`payments.methods.${i}.title`),
    description: t(`payments.methods.${i}.description`),
    icon: t(`payments.methods.${i}.icon`),
    tag: t(`payments.methods.${i}.tag`),
    tagVariant: t(`payments.methods.${i}.tagVariant`),
  }))

  const reviews = [0, 1, 2].map(i => ({
    name: t(`reviews.placeholder.${i}.name`),
    review: t(`reviews.placeholder.${i}.review`),
    game: t(`reviews.placeholder.${i}.game`),
  }))

  return (
    <div className="landing-page relative z-10">

      {/* ── Hero ── */}
      <section className="relative max-w-5xl mx-auto px-6 pt-28 pb-24 text-center overflow-hidden">
        {/* Warm glow */}
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 720, height: 480, background: 'radial-gradient(ellipse, rgba(245,166,35,0.11) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Decorative dice */}
        <div className="hidden md:block" style={{ position: 'absolute', left: '4%', top: '22%', zIndex: 0 }}>
          <DieFace value={6} size={68} rotate={-14} opacity={0.11} />
        </div>
        <div className="hidden md:block" style={{ position: 'absolute', right: '6%', top: '12%', zIndex: 0 }}>
          <DieFace value={4} size={50} rotate={17} opacity={0.09} />
        </div>
        <div className="hidden md:block" style={{ position: 'absolute', right: '3%', bottom: '22%', zIndex: 0 }}>
          <DieFace value={2} size={38} rotate={-9} opacity={0.07} />
        </div>
        <div className="hidden md:block" style={{ position: 'absolute', left: '12%', bottom: '18%', zIndex: 0 }}>
          <DieFace value={5} size={42} rotate={11} opacity={0.07} />
        </div>

        <div className="relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8" style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.22)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: amber }} />
            <span className="font-headline font-bold text-[11px] uppercase tracking-[.08em]" style={{ color: amber }}>{t('hero.badge')}</span>
          </div>

          <h1 className="font-headline font-black tracking-[-0.04em] leading-[1.03] mb-6" style={{ fontSize: 'clamp(44px,5.5vw,72px)', color: text }}>
            {t('hero.headline')}
          </h1>

          <p className="font-body text-[17px] leading-relaxed max-w-lg mx-auto mb-10" style={{ color: muted }}>
            {t('hero.subheadline')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/${locale}/auth/register`}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-headline font-extrabold text-[15px] text-center transition-all hover:brightness-110"
              style={{ background: amber, color: '#0b0d12', boxShadow: '0 8px 32px rgba(245,166,35,0.3)' }}
            >
              {t('hero.ctaPrimary')}
            </Link>
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-headline font-bold text-[14px] text-center transition-all"
              style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)', color: text }}
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Core Features ── */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <LPSectionHeader overline={t('features.overline')} headline={t('features.headline')} />
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = ICONS[f.icon] ?? Dices
            return (
              <div key={i} className="rounded-2xl p-6 transition-all hover:-translate-y-1" style={{ ...card, transitionDuration: '200ms' }}>
                <div className="w-11 h-11 rounded-[10px] flex items-center justify-center mb-4" style={{ background: 'rgba(245,166,35,0.1)' }}>
                  <Icon size={22} style={{ color: amber }} />
                </div>
                <h3 className="font-headline font-extrabold text-[17px] tracking-[-0.02em] mb-2" style={{ color: text }}>{f.title}</h3>
                <p className="font-body text-[14px] leading-relaxed" style={{ color: muted }}>{f.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20" style={{ background: '#0f1117' }}>
        <div className="max-w-5xl mx-auto px-6">
          <LPSectionHeader overline={t('howItWorks.overline')} headline={t('howItWorks.headline')} subheadline={t('howItWorks.subheadline')} />
          <div className="grid md:grid-cols-4 gap-5">
            {howItWorksSteps.map((step, i) => {
              const Icon = ICONS[step.icon] ?? Dices
              return (
                <div key={i} className="relative">
                  {i < 3 && (
                    <div className="hidden md:block absolute top-[18px] left-[calc(100%-6px)] w-6 h-px z-10" style={{ background: 'linear-gradient(to right, rgba(245,166,35,0.35), rgba(245,166,35,0.08))' }} />
                  )}
                  <div className="rounded-2xl p-6 h-full" style={card}>
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: amber, boxShadow: '0 4px 14px rgba(245,166,35,0.28)' }}>
                        <Icon size={17} strokeWidth={2.2} style={{ color: '#0b0d12' }} />
                      </div>
                      <span className="font-headline font-black text-[10px] uppercase tracking-[.12em]" style={{ color: amber }}>{step.label}</span>
                    </div>
                    <h3 className="font-headline font-extrabold text-[15px] tracking-[-0.02em] mb-2" style={{ color: text }}>{step.title}</h3>
                    <p className="font-body text-[13px] leading-relaxed" style={{ color: muted }}>{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Group Features ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <LPSectionHeader overline={t('group.overline')} headline={t('group.headline')} subheadline={t('group.subheadline')} />
        <div className="grid md:grid-cols-2 gap-5 mb-10">
          {groupItems.map((item, i) => {
            const Icon = ICONS[item.icon] ?? Trophy
            return (
              <div key={i} className="flex gap-4 rounded-2xl p-6 transition-all hover:-translate-y-0.5" style={{ ...card, transitionDuration: '200ms' }}>
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(245,166,35,0.1)' }}>
                  <Icon size={20} style={{ color: amber }} />
                </div>
                <div>
                  <h3 className="font-headline font-extrabold text-[16px] tracking-[-0.02em] mb-1" style={{ color: text }}>{item.title}</h3>
                  <p className="font-body text-[14px] leading-relaxed" style={{ color: muted }}>{item.description}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-center">
          <Link
            href={`/${locale}/auth/register`}
            className="inline-block px-8 py-3.5 rounded-2xl font-headline font-bold text-[14px] transition-all hover:brightness-110"
            style={{ background: amber, color: '#0b0d12', boxShadow: '0 4px 20px rgba(245,166,35,0.28)' }}
          >
            {t('group.cta')}
          </Link>
        </div>
      </section>

      {/* ── Credits ── */}
      <section className="py-20" style={{ background: '#0f1117' }}>
        <div className="max-w-5xl mx-auto px-6">
          <LPSectionHeader overline={t('credits.overline')} headline={t('credits.headline')} subheadline={t('credits.subheadline')} />
          <div className="grid md:grid-cols-3 gap-6">

            {/* Free monthly */}
            <div className="rounded-2xl p-7 text-center relative overflow-hidden" style={{ background: 'linear-gradient(150deg, #161100 0%, #1c1700 100%)', border: '1px solid rgba(245,166,35,0.28)', boxShadow: '0 8px 40px rgba(245,166,35,0.1)' }}>
              <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 220, height: 220, background: 'radial-gradient(ellipse, rgba(245,166,35,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div className="relative z-10">
                <div className="inline-flex items-center px-3 py-1 rounded-full mb-4" style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.28)' }}>
                  <span className="font-headline font-bold text-[10px] uppercase tracking-[.08em]" style={{ color: amber }}>{t('credits.free.badge')}</span>
                </div>
                <div className="font-headline font-black leading-none tracking-[-0.04em] mb-1" style={{ fontSize: 76, color: amber, textShadow: '0 0 48px rgba(245,166,35,0.35)' }}>
                  {t('credits.free.amount')}
                </div>
                <div className="font-headline font-bold text-[13px] mb-4" style={{ color: 'rgba(245,166,35,0.55)' }}>{t('credits.free.label')}</div>
                <p className="font-body text-[13px] leading-relaxed" style={{ color: muted }}>{t('credits.free.description')}</p>
              </div>
            </div>

            {/* Cost table */}
            <div className="rounded-2xl p-7" style={card}>
              <h3 className="font-headline font-extrabold text-[16px] tracking-[-0.02em] mb-5" style={{ color: text }}>{t('credits.costs.title')}</h3>
              <div>
                {creditCosts.map((item, i) => {
                  const Icon = ICONS[item.icon] ?? Dices
                  return (
                    <div key={i} className="flex items-center justify-between py-3" style={{ borderBottom: i < creditCosts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} style={{ color: muted, flexShrink: 0 }} />
                        <span className="font-body text-[13.5px]" style={{ color: text }}>{item.action}</span>
                      </div>
                      <span className="font-headline font-bold text-[13px] ml-2 flex-shrink-0" style={{ color: amber }}>
                        {item.cost} {t('credits.costs.credits')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Example */}
            <div className="rounded-2xl p-7" style={card}>
              <h3 className="font-headline font-extrabold text-[16px] tracking-[-0.02em] mb-3" style={{ color: text }}>{t('credits.example.title')}</h3>
              <p className="font-body text-[13.5px] leading-relaxed mb-5" style={{ color: muted }}>{t('credits.example.description')}</p>
              <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.14)' }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: amber }} />
                <p className="font-body text-[12.5px] leading-relaxed" style={{ color: amber }}>{t('credits.example.note')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Credit Packs ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <LPSectionHeader overline={t('packs.overline')} headline={t('packs.headline')} subheadline={t('packs.subheadline')} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          {packs.map((pack, i) => {
            const isFeatured = !!pack.tag
            return (
              <div
                key={i}
                className="relative rounded-2xl p-6 text-center transition-all hover:-translate-y-1"
                style={isFeatured
                  ? { background: 'linear-gradient(150deg, #161100 0%, #1c1700 100%)', border: '1px solid rgba(245,166,35,0.35)', boxShadow: '0 8px 32px rgba(245,166,35,0.14)', transitionDuration: '200ms' }
                  : { ...card, transitionDuration: '200ms' }
                }
              >
                {pack.tag && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full font-headline font-bold text-[10px] uppercase tracking-[.08em] whitespace-nowrap" style={{ background: amber, color: '#0b0d12', boxShadow: '0 2px 10px rgba(245,166,35,0.4)' }}>
                    {pack.tag}
                  </div>
                )}
                <div className="font-headline font-black tracking-[-0.03em] leading-none mb-1" style={{ fontSize: 36, color: isFeatured ? amber : text }}>
                  {pack.credits}
                </div>
                <div className="font-headline font-bold text-[11px] uppercase tracking-[.08em] mb-4" style={{ color: isFeatured ? 'rgba(245,166,35,0.5)' : muted }}>
                  credits
                </div>
                <div className="font-headline font-black tracking-[-0.02em]" style={{ fontSize: 22, color: text }}>
                  {pack.price}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-center font-body text-[12px] mb-8" style={{ color: dim }}>{t('packs.priceNote')}</p>
        <div className="text-center">
          <Link
            href={`/${locale}/auth/register`}
            className="inline-block px-8 py-3.5 rounded-2xl font-headline font-bold text-[14px] transition-all hover:brightness-110"
            style={{ background: amber, color: '#0b0d12', boxShadow: '0 4px 20px rgba(245,166,35,0.28)' }}
          >
            {t('packs.cta')}
          </Link>
        </div>
      </section>

      {/* ── Payment Options ── */}
      <section className="py-20" style={{ background: '#0f1117' }}>
        <div className="max-w-5xl mx-auto px-6">
          <LPSectionHeader overline={t('payments.overline')} headline={t('payments.headline')} />
          <div className="grid md:grid-cols-3 gap-5">
            {paymentMethods.map((method, i) => {
              const Icon = ICONS[method.icon] ?? CreditCard
              const isHighlight = method.tagVariant === 'highlight'
              return (
                <div key={i} className="rounded-2xl p-6" style={card}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(245,166,35,0.1)' }}>
                      <Icon size={20} style={{ color: amber }} />
                    </div>
                    {method.tag && (
                      <span
                        className="px-2.5 py-1 rounded-full font-headline font-bold text-[10px] uppercase tracking-[.06em]"
                        style={isHighlight ? { background: amber, color: '#0b0d12', boxShadow: '0 2px 8px rgba(245,166,35,0.35)' } : { background: 'rgba(255,255,255,0.06)', color: muted }}
                      >
                        {method.tag}
                      </span>
                    )}
                  </div>
                  <h3 className="font-headline font-extrabold text-[16px] tracking-[-0.02em] mb-2" style={{ color: text }}>{method.title}</h3>
                  <p className="font-body text-[13.5px] leading-relaxed" style={{ color: muted }}>{method.description}</p>
                </div>
              )
            })}
          </div>
          <p className="text-center font-body text-[12px] mt-6" style={{ color: dim }}>{t('payments.note')}</p>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <LPSectionHeader overline={t('reviews.overline')} headline={t('reviews.headline')} />
        <div className="grid md:grid-cols-3 gap-5">
          {reviews.map((review, i) => (
            <div key={i} className="rounded-2xl p-6" style={card}>
              <div className="font-headline font-black leading-none mb-2" style={{ fontSize: 44, color: 'rgba(245,166,35,0.2)', lineHeight: 0.9 }}>&ldquo;</div>
              <p className="font-body text-[14px] leading-relaxed mb-5" style={{ color: text }}>{review.review}</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.1)' }}>
                  <span className="font-headline font-black text-[11px]" style={{ color: amber }}>{review.name.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-headline font-bold text-[13px]" style={{ color: text }}>{review.name}</div>
                  <div className="font-body text-[12px]" style={{ color: muted }}>{review.game}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="relative rounded-3xl px-8 py-16 text-center overflow-hidden" style={{ background: 'linear-gradient(150deg, #161100 0%, #1c1700 60%, #141100 100%)', border: '1px solid rgba(245,166,35,0.22)', boxShadow: '0 16px 64px rgba(245,166,35,0.1)' }}>
          <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 560, height: 340, background: 'radial-gradient(ellipse, rgba(245,166,35,0.13) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div className="relative z-10">
            <h2 className="font-headline font-black tracking-[-0.03em] mb-4" style={{ fontSize: 'clamp(28px,4vw,42px)', color: text }}>{t('cta.headline')}</h2>
            <p className="font-body text-base mb-8 max-w-md mx-auto" style={{ color: muted }}>{t('cta.body')}</p>
            <Link
              href={`/${locale}/auth/register`}
              className="inline-block px-10 py-4 rounded-2xl font-headline font-extrabold text-[15px] transition-all hover:brightness-110"
              style={{ background: amber, color: '#0b0d12', boxShadow: '0 8px 36px rgba(245,166,35,0.32)' }}
            >
              {t('cta.button')}
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
