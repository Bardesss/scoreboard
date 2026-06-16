'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { saveSettings } from './actions'

interface SettingsValues {
  monthly_free_credits: number
  cost_game_template: number
  cost_league: number
  cost_add_player: number
  cost_played_game: number
  low_credit_threshold: number
  free_mode_active: boolean
  free_mode_banner_nl: string
  free_mode_banner_en: string
}

interface Props {
  values: SettingsValues
  configuredCount: number
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.8)',
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 14,
}

// Width: full on mobile (stacked), fixed on desktop so the input doesn't blow
// past the card in the justify-between row (width:100% + label overflowed).
// Border + focus ring live here too so :focus-visible can override them —
// inline styles can't express focus state and `outline: none` alone left
// keyboard users with no visible focus indicator.
const inputClass =
  'w-full sm:w-[340px] sm:flex-shrink-0 border border-white/10 outline-none transition-colors focus-visible:border-[#4a8eff] focus-visible:ring-2 focus-visible:ring-[rgba(74,142,255,0.35)]'

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(255,255,255,0.6)',
  marginBottom: 6,
  display: 'block',
}

const cardStyle: React.CSSProperties = {
  background: '#161f28',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.87)',
  marginBottom: 20,
  letterSpacing: '-0.01em',
}

const fieldRowStyle: React.CSSProperties = {
  paddingBottom: 16,
  marginBottom: 16,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

const lastFieldRowStyle: React.CSSProperties = {}

const fieldRowClass = 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4'

export default function SettingsClient({ values, configuredCount }: Props) {
  const [form, setForm] = useState<SettingsValues>(values)
  // Baseline of last-saved values; updated on a successful save so the dirty
  // check doesn't keep warning after the user has already saved.
  const [baseline, setBaseline] = useState<SettingsValues>(values)
  const [isPending, startTransition] = useTransition()

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)

  // Warn before a full page unload (reload / tab close) with unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Guard the in-page shortcut links: client-side navigation unmounts this
  // form and would silently drop unsaved edits, so confirm first.
  function guardNav(e: React.MouseEvent) {
    if (dirty && !window.confirm('Niet-opgeslagen wijzigingen gaan verloren. Wil je doorgaan?')) {
      e.preventDefault()
    }
  }

  function setNum(key: keyof SettingsValues, val: string) {
    setForm((prev) => ({ ...prev, [key]: Number(val) }))
  }

  function setStr(key: keyof SettingsValues, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function setBool(key: keyof SettingsValues, val: boolean) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await saveSettings(form)
      if (result.success) {
        setBaseline(form)
        toast.success('Instellingen opgeslagen')
      } else {
        toast.error('Opslaan mislukt')
      }
    })
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            className="font-headline"
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.87)',
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}
          >
            Instellingen
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            Systeeminstellingen en kortingscodes beheren
          </p>
        </div>

        {/* Guarded like the in-page shortcuts: this is client-side nav away from
            the form, so confirm before dropping unsaved edits. */}
        <Link
          href="/admin/settings/discount-codes"
          onClick={guardNav}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#4a8eff',
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: 10,
            border: '1px solid rgba(74,142,255,0.25)',
            background: 'rgba(74,142,255,0.07)',
            whiteSpace: 'nowrap',
          }}
        >
          Kortingscodes →
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
      {/* Card 1: Credit instellingen */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Credit instellingen</div>

        {[
          { key: 'monthly_free_credits' as const, label: 'Maandelijkse gratis credits' },
          { key: 'cost_game_template' as const, label: 'Kosten spelsjabloon' },
          { key: 'cost_league' as const, label: 'Kosten competitie' },
          { key: 'cost_add_player' as const, label: 'Kosten speler toevoegen' },
          { key: 'cost_played_game' as const, label: 'Kosten partij loggen' },
          { key: 'low_credit_threshold' as const, label: 'Drempelwaarde lage credits' },
        ].map(({ key, label }, i, arr) => (
          <div key={key} className={fieldRowClass} style={i < arr.length - 1 ? fieldRowStyle : lastFieldRowStyle}>
            <label htmlFor={key} style={labelStyle}>
              {label}
            </label>
            <input
              id={key}
              type="number"
              min={0}
              value={form[key] as number}
              onChange={(e) => setNum(key, e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      {/* Card 2: Gratis modus */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Gratis modus</div>

        {/* Toggle */}
        <div className={fieldRowClass} style={fieldRowStyle}>
          <label style={labelStyle}>Gratis modus actief</label>
          <button
            type="button"
            onClick={() => setBool('free_mode_active', !form.free_mode_active)}
            style={{
              width: 48,
              height: 26,
              borderRadius: 13,
              border: 'none',
              cursor: 'pointer',
              background: form.free_mode_active ? '#005bc0' : 'rgba(255,255,255,0.15)',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
            role="switch"
            aria-checked={form.free_mode_active}
            aria-label="Gratis modus actief"
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: form.free_mode_active ? 25 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            />
          </button>
        </div>

        <p
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.55)',
            marginBottom: 16,
            lineHeight: 1.4,
          }}
        >
          Als actief: de waarschuwing voor lage credits is verborgen, en de gratis-modus banner verschijnt in de app en op de landingspagina.
        </p>

        {/* Banner NL */}
        <div className={fieldRowClass} style={fieldRowStyle}>
          <label htmlFor="free_mode_banner_nl" style={labelStyle}>
            Banner tekst (NL)
          </label>
          <input
            id="free_mode_banner_nl"
            type="text"
            value={form.free_mode_banner_nl}
            onChange={(e) => setStr('free_mode_banner_nl', e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="Bannertekst voor NL"
          />
        </div>

        {/* Banner EN */}
        <div className={fieldRowClass} style={lastFieldRowStyle}>
          <label htmlFor="free_mode_banner_en" style={labelStyle}>
            Banner tekst (EN)
          </label>
          <input
            id="free_mode_banner_en"
            type="text"
            value={form.free_mode_banner_en}
            onChange={(e) => setStr('free_mode_banner_en', e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="Banner text for EN"
          />
        </div>
      </div>

      {/* Integrations shortcut */}
      <Link
        href="/admin/settings/integrations"
        onClick={guardNav}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          ...cardStyle,
          textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ ...cardTitleStyle, marginBottom: 4 }}>Integraties</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            {configuredCount} van 4 geconfigureerd
          </div>
        </div>
        <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</span>
      </Link>

      {/* Cost recommendations shortcut */}
      <Link
        href="/admin/settings/recommendations"
        onClick={guardNav}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          ...cardStyle,
          textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ ...cardTitleStyle, marginBottom: 4 }}>Kostenaanbevelingen</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Advies voor het maandelijkse tegoed op basis van verbruik
          </div>
        </div>
        <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</span>
      </Link>

      <button
        type="submit"
        disabled={isPending}
        style={{
          background: '#005bc0',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '8px 18px',
          fontSize: 14,
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {isPending ? 'Opslaan…' : 'Instellingen opslaan'}
      </button>
      </form>
    </div>
  )
}
