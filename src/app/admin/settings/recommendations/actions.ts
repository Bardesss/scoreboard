'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadCostAnalytics } from '@/lib/admin/costAnalytics'
import { recommendForScenario, RECOMMENDATION_WINDOWS, type Scenario } from '@/lib/admin/costRecommendations'

export type ApplyScenarioResult =
  | { ok: true; newValue: number }
  | { ok: false; error: string }

const MONTHLY_CREDITS_KEY = 'monthly_free_credits'
const MONTHLY_CREDITS_DEFAULT = 75

async function isAdmin(): Promise<boolean> {
  const session = await auth()
  return !!session && session.user.role === 'admin'
}

async function readCurrentMonthlyCredits(): Promise<number> {
  const row = await prisma.adminSettings.findUnique({ where: { key: MONTHLY_CREDITS_KEY } })
  return typeof row?.value === 'number' ? row.value : MONTHLY_CREDITS_DEFAULT
}

/**
 * Apply a scenario's recommended `monthly_free_credits` to AdminSettings. The value is
 * re-derived server-side from `scenario` + `windowDays` — a client-supplied number is
 * never trusted. `status_quo` is a no-op (it means "keep current settings").
 */
export async function applyScenario(
  scenario: Scenario,
  windowDays: number,
): Promise<ApplyScenarioResult> {
  if (!(await isAdmin())) return { ok: false, error: 'unauthorized' }

  try {
    const current = await readCurrentMonthlyCredits()
    if (scenario === 'status_quo') {
      return { ok: true, newValue: current }
    }

    const window = RECOMMENDATION_WINDOWS.includes(windowDays) ? windowDays : 30
    const analytics = await loadCostAnalytics(window)
    const { monthlyFreeCredits } = recommendForScenario(scenario, analytics, current)

    await prisma.adminSettings.upsert({
      where: { key: MONTHLY_CREDITS_KEY },
      update: { value: monthlyFreeCredits as Prisma.InputJsonValue },
      create: { key: MONTHLY_CREDITS_KEY, value: monthlyFreeCredits as Prisma.InputJsonValue },
    })

    revalidatePath('/admin/settings/recommendations')
    revalidatePath('/admin/settings')
    return { ok: true, newValue: monthlyFreeCredits }
  } catch (e) {
    console.error('[recommendations] applyScenario failed', e)
    return { ok: false, error: 'unknown' }
  }
}
