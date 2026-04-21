import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import SettingsClient from './SettingsClient'

const DEFAULTS = {
  monthly_free_credits: 75,
  cost_game_template: 25,
  cost_league: 10,
  cost_add_player: 10,
  cost_played_game: 5,
  low_credit_threshold: 20,
  free_mode_active: false,
  free_mode_banner_nl: '',
  free_mode_banner_en: '',
}

export default async function AdminSettingsPage() {
  const rows = await prisma.adminSettings.findMany()

  const raw: Record<string, unknown> = {}
  for (const row of rows) {
    raw[row.key] = row.value
  }

  const values = {
    monthly_free_credits:
      typeof raw.monthly_free_credits === 'number'
        ? raw.monthly_free_credits
        : DEFAULTS.monthly_free_credits,
    cost_game_template:
      typeof raw.cost_game_template === 'number'
        ? raw.cost_game_template
        : DEFAULTS.cost_game_template,
    cost_league:
      typeof raw.cost_league === 'number' ? raw.cost_league : DEFAULTS.cost_league,
    cost_add_player:
      typeof raw.cost_add_player === 'number' ? raw.cost_add_player : DEFAULTS.cost_add_player,
    cost_played_game:
      typeof raw.cost_played_game === 'number' ? raw.cost_played_game : DEFAULTS.cost_played_game,
    low_credit_threshold:
      typeof raw.low_credit_threshold === 'number'
        ? raw.low_credit_threshold
        : DEFAULTS.low_credit_threshold,
    free_mode_active:
      typeof raw.free_mode_active === 'boolean'
        ? raw.free_mode_active
        : DEFAULTS.free_mode_active,
    free_mode_banner_nl:
      typeof raw.free_mode_banner_nl === 'string'
        ? raw.free_mode_banner_nl
        : DEFAULTS.free_mode_banner_nl,
    free_mode_banner_en:
      typeof raw.free_mode_banner_en === 'string'
        ? raw.free_mode_banner_en
        : DEFAULTS.free_mode_banner_en,
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

        <Link
          href="/admin/settings/discount-codes"
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

      <SettingsClient values={values} />
    </div>
  )
}
