import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import {
  Dices, BarChart2, Shield,
  Trophy, UserCheck, Share2, Bell,
  Vault, Users, ClipboardList, UserPlus,
  Building2, CreditCard, Zap,
} from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  Dices, BarChart2, Shield, Trophy, UserCheck, Share2, Bell,
  Vault, Users, ClipboardList, UserPlus, Building2, CreditCard, Zap,
}

function SectionHeader({ overline, headline, subheadline }: { overline: string; headline: string; subheadline?: string }) {
  return (
    <div className="text-center mb-12">
      <p className="font-headline font-black text-[9.5px] uppercase tracking-[.18em] text-outline-variant mb-3">{overline}</p>
      <h2 className="font-headline font-black text-on-surface tracking-[-0.03em]" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>{headline}</h2>
      {subheadline && <p className="font-body text-on-surface-variant text-base mt-3 max-w-xl mx-auto">{subheadline}</p>}
    </div>
  )
}

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
    <div className="relative z-10">

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-container mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-headline font-bold text-[11px] uppercase tracking-[.06em] text-primary">{t('hero.badge')}</span>
        </div>
        <h1 className="font-headline font-black text-on-surface tracking-[-0.04em] leading-[1.05] mb-6" style={{ fontSize: 'clamp(38px,5vw,62px)' }}>
          {t('hero.headline')}
        </h1>
        <p className="font-body text-on-surface-variant text-lg leading-relaxed max-w-xl mx-auto mb-10">
          {t('hero.subheadline')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={`/${locale}/auth/register`} className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary text-on-primary font-headline font-extrabold text-[15px] text-center transition-all hover:bg-primary-dim" style={{ boxShadow: '0 8px 28px rgba(0,91,192,0.28)' }}>
            {t('hero.ctaPrimary')}
          </Link>
          <Link href="#how-it-works" className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-container-low text-on-surface font-headline font-bold text-[14px] text-center hover:bg-surface-container transition-colors">
            {t('hero.ctaSecondary')}
          </Link>
        </div>
      </section>

      {/* ── Core Features ── */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <SectionHeader overline={t('features.overline')} headline={t('features.headline')} />
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = ICONS[f.icon] ?? Dices
            return (
              <div key={i} className="bg-white rounded-2xl p-6 transition-all hover:-translate-y-1" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
                <div className="w-11 h-11 rounded-[10px] bg-primary-container flex items-center justify-center mb-4">
                  <Icon size={22} className="text-primary" />
                </div>
                <h3 className="font-headline font-extrabold text-[17px] text-on-surface tracking-[-0.02em] mb-2">{f.title}</h3>
                <p className="font-body text-[14px] text-on-surface-variant leading-relaxed">{f.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── How It Works — Vault > Games > Players > Leagues ── */}
      <section id="how-it-works" className="bg-surface-container-low py-20">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader overline={t('howItWorks.overline')} headline={t('howItWorks.headline')} subheadline={t('howItWorks.subheadline')} />
          <div className="grid md:grid-cols-4 gap-6">
            {howItWorksSteps.map((step, i) => {
              const Icon = ICONS[step.icon] ?? Dices
              return (
                <div key={i} className="relative">
                  {i < 3 && (
                    <div className="hidden md:block absolute top-9 left-[calc(100%-12px)] w-6 h-0.5 bg-surface-container-high z-10" />
                  )}
                  <div className="bg-white rounded-2xl p-6 h-full" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
                        <Icon size={18} strokeWidth={2.2} className="text-on-primary" />
                      </div>
                      <span className="font-headline font-black text-[10px] uppercase tracking-[.12em] text-primary">{step.label}</span>
                    </div>
                    <h3 className="font-headline font-extrabold text-[15px] text-on-surface tracking-[-0.02em] mb-2">{step.title}</h3>
                    <p className="font-body text-[13px] text-on-surface-variant leading-relaxed">{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Group Features USP ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <SectionHeader overline={t('group.overline')} headline={t('group.headline')} subheadline={t('group.subheadline')} />
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {groupItems.map((item, i) => {
            const Icon = ICONS[item.icon] ?? Trophy
            return (
              <div key={i} className="flex gap-4 bg-white rounded-2xl p-6 transition-all hover:-translate-y-0.5" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
                <div className="w-10 h-10 rounded-[10px] bg-primary-container flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-headline font-extrabold text-[16px] text-on-surface tracking-[-0.02em] mb-1">{item.title}</h3>
                  <p className="font-body text-[14px] text-on-surface-variant leading-relaxed">{item.description}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-center">
          <Link href={`/${locale}/auth/register`} className="inline-block px-8 py-3.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-[14px] hover:bg-primary-dim transition-all" style={{ boxShadow: '0 4px 14px rgba(0,91,192,0.28)' }}>
            {t('group.cta')}
          </Link>
        </div>
      </section>

      {/* ── How Credits Work ── */}
      <section className="bg-surface-container-low py-20">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader overline={t('credits.overline')} headline={t('credits.headline')} subheadline={t('credits.subheadline')} />
          <div className="grid md:grid-cols-3 gap-8">

            {/* Free monthly block */}
            <div className="bg-primary rounded-2xl p-7 text-center" style={{ boxShadow: '0 8px 28px rgba(0,91,192,0.28)' }}>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 mb-4">
                <span className="font-headline font-bold text-[10px] uppercase tracking-[.08em] text-on-primary">{t('credits.free.badge')}</span>
              </div>
              <div className="font-headline font-black text-[56px] text-on-primary leading-none tracking-[-0.04em]">{t('credits.free.amount')}</div>
              <div className="font-headline font-bold text-[13px] text-on-primary/70 mb-3">{t('credits.free.label')}</div>
              <p className="font-body text-[13px] text-on-primary/80 leading-relaxed">{t('credits.free.description')}</p>
            </div>

            {/* Action cost table */}
            <div className="bg-white rounded-2xl p-7" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
              <h3 className="font-headline font-extrabold text-[16px] text-on-surface tracking-[-0.02em] mb-5">{t('credits.costs.title')}</h3>
              <div className="space-y-0">
                {creditCosts.map((item, i) => {
                  const Icon = ICONS[item.icon] ?? Dices
                  return (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-surface-container-low last:border-0">
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className="text-on-surface-variant flex-shrink-0" />
                        <span className="font-body text-[13.5px] text-on-surface">{item.action}</span>
                      </div>
                      <span className="font-headline font-bold text-[13px] text-primary flex-shrink-0 ml-2">
                        {item.cost} {t('credits.costs.credits')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Example + note */}
            <div className="bg-white rounded-2xl p-7" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
              <h3 className="font-headline font-extrabold text-[16px] text-on-surface tracking-[-0.02em] mb-3">{t('credits.example.title')}</h3>
              <p className="font-body text-[13.5px] text-on-surface-variant leading-relaxed mb-5">{t('credits.example.description')}</p>
              <div className="flex items-start gap-2.5 bg-primary-container rounded-xl p-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="font-body text-[12.5px] text-primary leading-relaxed">{t('credits.example.note')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Credit Packs ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <SectionHeader overline={t('packs.overline')} headline={t('packs.headline')} subheadline={t('packs.subheadline')} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          {packs.map((pack, i) => (
            <div key={i} className={`relative rounded-2xl p-6 text-center transition-all hover:-translate-y-1 ${pack.tag ? 'bg-primary text-on-primary' : 'bg-white'}`} style={{ boxShadow: pack.tag ? '0 8px 28px rgba(0,91,192,0.28)' : '0 2px 12px rgba(43,52,55,0.05)' }}>
              {pack.tag && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white font-headline font-bold text-[10px] uppercase tracking-[.08em] text-primary whitespace-nowrap" style={{ boxShadow: '0 2px 8px rgba(0,91,192,0.2)' }}>
                  {pack.tag}
                </div>
              )}
              <div className={`font-headline font-black text-[36px] tracking-[-0.03em] leading-none mb-1 ${pack.tag ? 'text-on-primary' : 'text-on-surface'}`}>
                {pack.credits}
              </div>
              <div className={`font-headline font-bold text-[11px] uppercase tracking-[.08em] mb-4 ${pack.tag ? 'text-on-primary/70' : 'text-outline-variant'}`}>credits</div>
              <div className={`font-headline font-black text-[22px] tracking-[-0.02em] ${pack.tag ? 'text-on-primary' : 'text-on-surface'}`}>{pack.price}</div>
            </div>
          ))}
        </div>
        <p className="text-center font-body text-[12px] text-outline-variant mb-8">{t('packs.priceNote')}</p>
        <div className="text-center">
          <Link href={`/${locale}/auth/register`} className="inline-block px-8 py-3.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-[14px] hover:bg-primary-dim transition-all" style={{ boxShadow: '0 4px 14px rgba(0,91,192,0.28)' }}>
            {t('packs.cta')}
          </Link>
        </div>
      </section>

      {/* ── Payment Options ── */}
      <section className="bg-surface-container-low py-20">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader overline={t('payments.overline')} headline={t('payments.headline')} />
          <div className="grid md:grid-cols-3 gap-6">
            {paymentMethods.map((method, i) => {
              const Icon = ICONS[method.icon] ?? CreditCard
              const isHighlight = method.tagVariant === 'highlight'
              return (
                <div key={i} className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-[10px] bg-primary-container flex items-center justify-center">
                      <Icon size={20} className="text-primary" />
                    </div>
                    {method.tag && (
                      <span className={`px-2.5 py-1 rounded-full font-headline font-bold text-[10px] uppercase tracking-[.06em] ${isHighlight ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`} style={isHighlight ? { boxShadow: '0 2px 8px rgba(0,91,192,0.28)' } : {}}>
                        {method.tag}
                      </span>
                    )}
                  </div>
                  <h3 className="font-headline font-extrabold text-[16px] text-on-surface tracking-[-0.02em] mb-2">{method.title}</h3>
                  <p className="font-body text-[13.5px] text-on-surface-variant leading-relaxed">{method.description}</p>
                </div>
              )
            })}
          </div>
          <p className="text-center font-body text-[12px] text-outline-variant mt-6">{t('payments.note')}</p>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <SectionHeader overline={t('reviews.overline')} headline={t('reviews.headline')} />
        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((review, i) => (
            <div key={i} className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
              <p className="font-body text-[14px] text-on-surface leading-relaxed mb-5">&ldquo;{review.review}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                  <span className="font-headline font-black text-[11px] text-primary">{review.name.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-headline font-bold text-[13px] text-on-surface">{review.name}</div>
                  <div className="font-body text-[12px] text-on-surface-variant">{review.game}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-primary rounded-3xl px-8 py-16 text-center" style={{ boxShadow: '0 8px 28px rgba(0,91,192,0.28)' }}>
          <h2 className="font-headline font-black text-on-primary tracking-[-0.03em] mb-4" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>{t('cta.headline')}</h2>
          <p className="font-body text-on-primary/75 text-base mb-8 max-w-md mx-auto">{t('cta.body')}</p>
          <Link href={`/${locale}/auth/register`} className="inline-block px-10 py-4 rounded-2xl bg-white text-primary font-headline font-extrabold text-[15px] hover:bg-surface-container-low transition-colors">
            {t('cta.button')}
          </Link>
        </div>
      </section>

    </div>
  )
}
