import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { loadCostAnalytics, getDaysOfActivity } from '@/lib/admin/costAnalytics'
import {
  recommendForScenario,
  RECOMMENDATION_WINDOWS,
  type Scenario,
  type ScenarioRecommendation,
} from '@/lib/admin/costRecommendations'
import { RecommendationsClient, type WindowData } from './RecommendationsClient'

const SCENARIOS: Scenario[] = ['conservative', 'balanced', 'aggressive', 'status_quo']

const DEFAULTS = {
  monthly_free_credits: 75,
  cost_game_template: 25,
  cost_league: 10,
  cost_add_player: 10,
  cost_played_game: 5,
}

export default async function RecommendationsPage() {
  const rows = await prisma.adminSettings.findMany()
  const raw: Record<string, unknown> = {}
  for (const row of rows) raw[row.key] = row.value
  const num = (key: string, fallback: number) =>
    typeof raw[key] === 'number' ? (raw[key] as number) : fallback

  const currentMonthlyCredits = num('monthly_free_credits', DEFAULTS.monthly_free_credits)
  const currentCosts = {
    game_template: num('cost_game_template', DEFAULTS.cost_game_template),
    league: num('cost_league', DEFAULTS.cost_league),
    add_player: num('cost_add_player', DEFAULTS.cost_add_player),
    played_game: num('cost_played_game', DEFAULTS.cost_played_game),
  }

  const daysOfActivity = await getDaysOfActivity()

  const windows: WindowData[] = []
  for (const windowDays of RECOMMENDATION_WINDOWS) {
    const analytics = await loadCostAnalytics(windowDays)
    const scenarios = {} as Record<Scenario, ScenarioRecommendation>
    for (const scenario of SCENARIOS) {
      scenarios[scenario] = recommendForScenario(scenario, analytics, currentMonthlyCredits)
    }
    windows.push({ windowDays, activeUserCount: analytics.activeUsers.length, scenarios })
  }

  return (
    <div>
      <Link
        href="/admin/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={15} /> Terug naar Instellingen
      </Link>

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
        Kostenaanbevelingen
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
        Gekalibreerde adviezen voor het maandelijkse tegoed, op basis van echt verbruik.
        Kosten per actie blijven ongewijzigd — die beheer je in Instellingen.
      </p>

      <RecommendationsClient
        windows={windows}
        daysOfActivity={daysOfActivity}
        currentMonthlyCredits={currentMonthlyCredits}
        currentCosts={currentCosts}
      />
    </div>
  )
}
