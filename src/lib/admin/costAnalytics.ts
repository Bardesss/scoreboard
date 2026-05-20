import { prisma } from '@/lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

export type ActiveUserStats = {
  userId: string
  totalSpend: number
  actionCounts: Record<string, number>
}

export type PerActionStats = {
  reason: string
  p25: number
  p50: number
  p75: number
  p90: number
  mean: number
}

export type CostAnalytics = {
  activeUsers: ActiveUserStats[]
  perAction: PerActionStats[]
  windowStart: Date
  windowEnd: Date
}

/**
 * Linear-interpolation percentile (PERCENTILE.INC / R-7). `p` is 0-100.
 * Sorts a copy of the input; returns 0 for an empty array.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const rank = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}

/**
 * Aggregate credit-spend over a rolling window. "Active user" = a non-lifetime-free
 * user with at least one negative-delta CreditTransaction in the window. Top-ups,
 * refunds and monthly resets (positive deltas) are excluded.
 */
export async function loadCostAnalytics(windowDays: number): Promise<CostAnalytics> {
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - windowDays * DAY_MS)

  const rows = await prisma.creditTransaction.findMany({
    where: {
      createdAt: { gte: windowStart, lte: windowEnd },
      delta: { lt: 0 },
      user: { isLifetimeFree: false },
    },
    select: { userId: true, delta: true, reason: true },
  })

  const byUser = new Map<string, ActiveUserStats>()
  const spendByReason = new Map<string, number[]>()

  for (const row of rows) {
    const spend = Math.abs(row.delta)

    let user = byUser.get(row.userId)
    if (!user) {
      user = { userId: row.userId, totalSpend: 0, actionCounts: {} }
      byUser.set(row.userId, user)
    }
    user.totalSpend += spend
    user.actionCounts[row.reason] = (user.actionCounts[row.reason] ?? 0) + 1

    const amounts = spendByReason.get(row.reason) ?? []
    amounts.push(spend)
    spendByReason.set(row.reason, amounts)
  }

  const perAction: PerActionStats[] = [...spendByReason.entries()].map(([reason, amounts]) => ({
    reason,
    p25: percentile(amounts, 25),
    p50: percentile(amounts, 50),
    p75: percentile(amounts, 75),
    p90: percentile(amounts, 90),
    mean: amounts.reduce((sum, a) => sum + a, 0) / amounts.length,
  }))

  return { activeUsers: [...byUser.values()], perAction, windowStart, windowEnd }
}

/** Whole days elapsed since the earliest CreditTransaction in the system (0 if none). */
export async function getDaysOfActivity(): Promise<number> {
  const earliest = await prisma.creditTransaction.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
  if (!earliest) return 0
  return Math.floor((Date.now() - earliest.createdAt.getTime()) / DAY_MS)
}
