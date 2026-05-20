'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Scenario, ScenarioRecommendation } from '@/lib/admin/costRecommendations'
import { applyScenario } from './actions'

export type WindowData = {
  windowDays: number
  activeUserCount: number
  scenarios: Record<Scenario, ScenarioRecommendation>
}

export type RecommendationsClientProps = {
  windows: WindowData[]
  daysOfActivity: number
  currentMonthlyCredits: number
  currentCosts: { game_template: number; league: number; add_player: number; played_game: number }
}

const MIN_ACTIVE_USERS = 10
const MIN_DAYS = 21

const SCENARIO_ORDER: Scenario[] = ['conservative', 'balanced', 'aggressive', 'status_quo']

const SCENARIO_META: Record<Scenario, { label: string; desc: string }> = {
  conservative: { label: 'Conservatief', desc: 'Alleen de top 25% van gebruikers zou credits moeten kopen.' },
  balanced: { label: 'Gebalanceerd', desc: 'De helft van de gebruikers komt uit met het maandelijkse tegoed.' },
  aggressive: { label: 'Agressief', desc: 'De meeste gebruikers zouden credits moeten kopen.' },
  status_quo: { label: 'Huidige instelling', desc: 'Huidige instellingen ongewijzigd laten.' },
}

const COST_LABELS: Record<keyof RecommendationsClientProps['currentCosts'], string> = {
  game_template: 'Speltemplate',
  league: 'Competitie',
  add_player: 'Speler toevoegen',
  played_game: 'Game loggen',
}

const cardBg = '#161f28'
const border = '1px solid rgba(255,255,255,0.07)'
const textColor = 'rgba(255,255,255,0.87)'
const mutedColor = 'rgba(255,255,255,0.45)'

export function RecommendationsClient({
  windows,
  daysOfActivity,
  currentMonthlyCredits,
  currentCosts,
}: RecommendationsClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [windowDays, setWindowDays] = useState<number>(windows[0]?.windowDays ?? 30)

  const active = windows.find(w => w.windowDays === windowDays) ?? windows[0]
  const gateOk = active.activeUserCount >= MIN_ACTIVE_USERS && daysOfActivity >= MIN_DAYS

  function onApply(scenario: Scenario, newValue: number) {
    if (!window.confirm(`Maandelijkse credits wijzigen van ${currentMonthlyCredits} naar ${newValue}?`)) {
      return
    }
    startTransition(async () => {
      const result = await applyScenario(scenario, windowDays)
      if (result.ok) {
        toast.success('Tegoed bijgewerkt. De volgende maandelijkse cron-tick gebruikt de nieuwe waarde.')
        router.refresh()
      } else {
        toast.error('Er ging iets mis. Probeer het opnieuw.')
      }
    })
  }

  return (
    <div>
      {/* Window selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <label htmlFor="window" style={{ fontSize: 13, color: mutedColor }}>
          Tijdvenster
        </label>
        <select
          id="window"
          value={windowDays}
          onChange={e => setWindowDays(Number(e.target.value))}
          style={{
            background: cardBg,
            color: textColor,
            border,
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
          }}
        >
          {windows.map(w => (
            <option key={w.windowDays} value={w.windowDays}>
              Laatste {w.windowDays} dagen
            </option>
          ))}
        </select>
      </div>

      {!gateOk ? (
        <div style={{ background: cardBg, border, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: textColor, marginBottom: 8 }}>
            Nog niet genoeg data
          </div>
          <p style={{ fontSize: 13.5, color: mutedColor, margin: 0, lineHeight: 1.6 }}>
            Aanbevelingen hebben minimaal {MIN_ACTIVE_USERS} actieve gebruikers en {MIN_DAYS} dagen
            activiteit nodig om betekenisvol te zijn. Op dit moment:{' '}
            <strong style={{ color: textColor }}>{active.activeUserCount} actieve gebruikers</strong>
            {' · '}
            <strong style={{ color: textColor }}>{daysOfActivity} dagen activiteit</strong>.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {SCENARIO_ORDER.map(scenario => {
            const rec = active.scenarios[scenario]
            const meta = SCENARIO_META[scenario]
            const isCurrent = rec.monthlyFreeCredits === currentMonthlyCredits
            const diff = rec.monthlyFreeCredits - currentMonthlyCredits
            const isRecommended = scenario === 'balanced'

            return (
              <div
                key={scenario}
                style={{
                  background: cardBg,
                  border: isRecommended ? '1px solid rgba(245,166,35,0.35)' : border,
                  borderRadius: 16,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: textColor }}>{meta.label}</div>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#4a8eff',
                        background: 'rgba(74,142,255,0.12)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Huidig
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: mutedColor, margin: 0, lineHeight: 1.5 }}>{meta.desc}</p>

                <div>
                  <div style={{ fontSize: 12, color: mutedColor }}>Maandelijks tegoed</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: textColor }}>
                    {rec.monthlyFreeCredits}
                    {diff !== 0 && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: mutedColor, marginLeft: 6 }}>
                        ({diff > 0 ? '+' : ''}{diff})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 4 }}>Kosten per actie (ongewijzigd):</div>
                  {(Object.keys(COST_LABELS) as Array<keyof typeof COST_LABELS>).map(key => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{COST_LABELS[key]}</span>
                      <span style={{ color: textColor }}>{currentCosts[key]}</span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: 12.5,
                    color: textColor,
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    lineHeight: 1.5,
                  }}
                >
                  <div>
                    <strong>{rec.predictedPositiveCount} van {rec.totalActiveUsers}</strong> actieve
                    gebruikers zouden op ≥0 credits eindigen.
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Mediane gebruiker houdt <strong>{rec.medianRemainingAtRecommended}</strong> credits over.
                  </div>
                </div>

                {isCurrent ? (
                  <div style={{ fontSize: 12, color: mutedColor, textAlign: 'center', padding: '8px 0' }}>
                    Actieve instelling
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onApply(scenario, rec.monthlyFreeCredits)}
                    disabled={pending}
                    style={{
                      background: isRecommended ? '#f5a623' : '#005bc0',
                      color: isRecommended ? '#0b0d12' : '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '9px 16px',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: pending ? 'not-allowed' : 'pointer',
                      opacity: pending ? 0.6 : 1,
                    }}
                  >
                    Dit scenario toepassen
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
