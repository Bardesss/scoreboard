'use client'

import { useState, useTransition } from 'react'
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
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.8)',
  borderRadius: 10,
  padding: '8px 14px',
  outline: 'none',
  fontSize: 14,
  width: '100%',
  maxWidth: 220,
}

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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: 16,
  marginBottom: 16,
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

const lastFieldRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

export default function SettingsClient({ values }: Props) {
  const [form, setForm] = useState<SettingsValues>(values)
  const [isPending, startTransition] = useTransition()

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
        toast.success('Instellingen opgeslagen')
      } else {
        toast.error('Opslaan mislukt')
      }
    })
  }

  return (
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
          <div key={key} style={i < arr.length - 1 ? fieldRowStyle : lastFieldRowStyle}>
            <label htmlFor={key} style={labelStyle}>
              {label}
            </label>
            <input
              id={key}
              type="number"
              min={0}
              value={form[key] as number}
              onChange={(e) => setNum(key, e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      {/* Card 2: Gratis modus */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Gratis modus</div>

        {/* Toggle */}
        <div style={fieldRowStyle}>
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
            aria-pressed={form.free_mode_active}
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

        {/* Banner NL */}
        <div style={fieldRowStyle}>
          <label htmlFor="free_mode_banner_nl" style={labelStyle}>
            Banner tekst (NL)
          </label>
          <input
            id="free_mode_banner_nl"
            type="text"
            value={form.free_mode_banner_nl}
            onChange={(e) => setStr('free_mode_banner_nl', e.target.value)}
            style={{ ...inputStyle, maxWidth: 340 }}
            placeholder="Bannertekst voor NL"
          />
        </div>

        {/* Banner EN */}
        <div style={lastFieldRowStyle}>
          <label htmlFor="free_mode_banner_en" style={labelStyle}>
            Banner tekst (EN)
          </label>
          <input
            id="free_mode_banner_en"
            type="text"
            value={form.free_mode_banner_en}
            onChange={(e) => setStr('free_mode_banner_en', e.target.value)}
            style={{ ...inputStyle, maxWidth: 340 }}
            placeholder="Banner text for EN"
          />
        </div>
      </div>

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
  )
}
