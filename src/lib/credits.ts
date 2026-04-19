import { prisma } from './prisma'
import { redis } from './redis'

export class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credits')
    this.name = 'InsufficientCreditsError'
  }
}

const COST_DEFAULTS: Record<string, number> = {
  game_template: 25,
  league: 10,
  add_player: 10,
  played_game: 5,
}

export async function getActionCost(action: string): Promise<number> {
  const setting = await prisma.adminSettings.findUnique({ where: { key: `cost_${action}` } })
  const raw = setting?.value
  return (typeof raw === 'number' ? raw : null) ?? COST_DEFAULTS[action] ?? 0
}

export async function isFreeModeActive(): Promise<boolean> {
  const toggle = await prisma.adminSettings.findUnique({ where: { key: 'free_mode_active' } })
  if (toggle?.value === true) return true
  const now = new Date()
  const period = await prisma.freePeriod.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
  })
  return !!period
}

export async function checkRateLimit(userId: string, action: string): Promise<void> {
  const key = `rl:${action}:${userId}`
  const result = await redis.set(key, '1', 'EX', 3, 'NX')
  if (!result) throw new Error('Rate limit: please wait before trying again')
}

export async function deductCredits(
  userId: string,
  action: string,
  meta?: Record<string, unknown>
): Promise<{ newMonthly: number; newPermanent: number }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { monthlyCredits: true, permanentCredits: true, isLifetimeFree: true },
  })

  if (user.isLifetimeFree) {
    return { newMonthly: user.monthlyCredits, newPermanent: user.permanentCredits }
  }

  const cost = await getActionCost(action)
  const freeModeActive = await isFreeModeActive()
  const { monthlyCredits: monthly, permanentCredits: permanent } = user

  if (!freeModeActive && monthly + permanent < cost) {
    throw new InsufficientCreditsError()
  }

  let newMonthly = monthly
  let newPermanent = permanent
  const txs: { pool: string; delta: number }[] = []

  if (monthly >= cost) {
    // Case A: monthly covers full cost
    newMonthly = monthly - cost
    txs.push({ pool: 'monthly', delta: -cost })
  } else if (monthly > 0) {
    // Case B: partial monthly, remainder from permanent (or negative)
    const partial = monthly
    const remainder = cost - partial
    if (permanent >= remainder) {
      newMonthly = 0
      newPermanent = permanent - remainder
      txs.push({ pool: 'monthly', delta: -partial })
      txs.push({ pool: 'permanent', delta: -remainder })
    } else {
      // freeModeActive guaranteed here (checked above)
      newMonthly = -(remainder - permanent)
      newPermanent = 0
      txs.push({ pool: 'monthly', delta: -partial })
      txs.push({ pool: 'permanent', delta: -permanent })
      if (remainder - permanent > 0) {
        txs.push({ pool: 'monthly', delta: -(remainder - permanent) })
      }
    }
  } else {
    // Case C: monthly <= 0, deduct from permanent (or further negative)
    if (permanent >= cost) {
      newPermanent = permanent - cost
      txs.push({ pool: 'permanent', delta: -cost })
    } else {
      // freeModeActive guaranteed here
      newPermanent = 0
      newMonthly = monthly - (cost - permanent)
      txs.push({ pool: 'permanent', delta: -permanent })
      txs.push({ pool: 'monthly', delta: -(cost - permanent) })
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { monthlyCredits: newMonthly, permanentCredits: newPermanent },
    }),
    ...txs.map(tx =>
      prisma.creditTransaction.create({
        data: { userId, delta: tx.delta, pool: tx.pool, reason: action, ...(meta ? { meta } : {}) },
      })
    ),
  ])

  return { newMonthly, newPermanent }
}
