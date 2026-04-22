import { prisma } from '@/lib/prisma'
import CreditsClient from './CreditsClient'

export default async function AdminCreditsPage() {
  const [users, transactions, freePeriods, totalSpent] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        monthlyCredits: true,
        permanentCredits: true,
        isLifetimeFree: true,
        creditTransactions: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.creditTransaction.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
      select: { delta: true, pool: true, reason: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.freePeriod.findMany({ orderBy: { startsAt: 'asc' } }),
    prisma.creditTransaction.aggregate({
      _sum: { delta: true },
      where: { delta: { lt: 0 } },
    }),
  ])

  const serializedUsers = users.map(u => ({
    id: u.id,
    email: u.email,
    monthlyCredits: u.monthlyCredits,
    permanentCredits: u.permanentCredits,
    isLifetimeFree: u.isLifetimeFree,
    lastActivity: u.creditTransactions[0]?.createdAt?.toISOString() ?? null,
  }))

  const serializedTransactions = transactions.map(t => ({
    delta: t.delta,
    pool: t.pool,
    reason: t.reason,
    date: t.createdAt.toISOString().split('T')[0],
  }))

  const serializedFreePeriods = freePeriods.map(fp => ({
    startsAt: fp.startsAt.toISOString(),
    endsAt: fp.endsAt.toISOString(),
  }))

  return (
    <CreditsClient
      users={serializedUsers}
      transactions={serializedTransactions}
      freePeriods={serializedFreePeriods}
      totalSpentAllTime={Math.abs(totalSpent._sum.delta ?? 0)}
    />
  )
}
