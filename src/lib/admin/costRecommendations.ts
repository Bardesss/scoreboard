import { type CostAnalytics, percentile } from './costAnalytics'

/** Valid rolling-window sizes (in days) for cost recommendations. */
export const RECOMMENDATION_WINDOWS: number[] = [30, 60, 90]

export type Scenario = 'conservative' | 'balanced' | 'aggressive' | 'status_quo'

export type ScenarioRecommendation = {
  monthlyFreeCredits: number
  predictedPositiveCount: number
  totalActiveUsers: number
  medianRemainingAtRecommended: number
}

/** Round up to the nearest multiple of 5 — keeps recommended allowances readable. */
export function ceilTo5(n: number): number {
  return Math.ceil(n / 5) * 5
}

/**
 * Recommend a `monthly_free_credits` allowance for one scenario, derived from the
 * distribution of per-user spend. Per-action costs are never adjusted — keeping them
 * constant means the predicted-positive counts are comparable across scenarios.
 */
export function recommendForScenario(
  scenario: Scenario,
  analytics: CostAnalytics,
  currentMonthlyCredits: number,
): ScenarioRecommendation {
  const spends = analytics.activeUsers.map(u => u.totalSpend)

  let monthlyFreeCredits: number
  if (scenario === 'conservative') monthlyFreeCredits = ceilTo5(percentile(spends, 75))
  else if (scenario === 'balanced') monthlyFreeCredits = ceilTo5(percentile(spends, 50))
  else if (scenario === 'aggressive') monthlyFreeCredits = ceilTo5(percentile(spends, 25))
  else monthlyFreeCredits = currentMonthlyCredits // status_quo

  const predictedPositiveCount = spends.filter(s => s <= monthlyFreeCredits).length
  const medianRemainingAtRecommended = monthlyFreeCredits - percentile(spends, 50)

  return {
    monthlyFreeCredits,
    predictedPositiveCount,
    totalActiveUsers: spends.length,
    medianRemainingAtRecommended,
  }
}
