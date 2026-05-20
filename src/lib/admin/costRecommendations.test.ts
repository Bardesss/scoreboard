import { describe, it, expect } from 'vitest'
import type { CostAnalytics } from './costAnalytics'
import { recommendForScenario, ceilTo5 } from './costRecommendations'

function analyticsWithSpends(spends: number[]): CostAnalytics {
  return {
    activeUsers: spends.map((totalSpend, i) => ({
      userId: `u${i}`,
      totalSpend,
      actionCounts: {},
    })),
    perAction: [],
    windowStart: new Date(),
    windowEnd: new Date(),
  }
}

describe('ceilTo5', () => {
  it('rounds up to the nearest multiple of 5', () => {
    expect(ceilTo5(0)).toBe(0)
    expect(ceilTo5(1)).toBe(5)
    expect(ceilTo5(25)).toBe(25)
    expect(ceilTo5(32.5)).toBe(35)
  })
})

describe('recommendForScenario', () => {
  const analytics = analyticsWithSpends([10, 20, 30, 40])
  const current = 50

  it('conservative — p75 of spend, rounded up to 5', () => {
    const r = recommendForScenario('conservative', analytics, current)
    expect(r).toEqual({
      monthlyFreeCredits: 35,
      predictedPositiveCount: 3,
      totalActiveUsers: 4,
      medianRemainingAtRecommended: 10,
    })
  })

  it('balanced — p50 of spend, rounded up to 5', () => {
    const r = recommendForScenario('balanced', analytics, current)
    expect(r).toEqual({
      monthlyFreeCredits: 25,
      predictedPositiveCount: 2,
      totalActiveUsers: 4,
      medianRemainingAtRecommended: 0,
    })
  })

  it('aggressive — p25 of spend, rounded up to 5', () => {
    const r = recommendForScenario('aggressive', analytics, current)
    expect(r).toEqual({
      monthlyFreeCredits: 20,
      predictedPositiveCount: 2,
      totalActiveUsers: 4,
      medianRemainingAtRecommended: -5,
    })
  })

  it('status_quo — keeps the current allowance', () => {
    const r = recommendForScenario('status_quo', analytics, current)
    expect(r).toEqual({
      monthlyFreeCredits: 50,
      predictedPositiveCount: 4,
      totalActiveUsers: 4,
      medianRemainingAtRecommended: 25,
    })
  })

  it('handles a single active user (percentiles collapse to that user)', () => {
    const r = recommendForScenario('conservative', analyticsWithSpends([30]), 50)
    expect(r).toEqual({
      monthlyFreeCredits: 30,
      predictedPositiveCount: 1,
      totalActiveUsers: 1,
      medianRemainingAtRecommended: 0,
    })
  })
})
