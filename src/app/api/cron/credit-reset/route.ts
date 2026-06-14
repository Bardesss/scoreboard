import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { isFreeModeActive } from '@/lib/credits'
import { getUnverifiedGraceDays } from '@/lib/accountSettings'
import { sendMonthlyResetEmail, sendTicketAutoClosedEmail } from '@/lib/mail'
import { purgeTicketAttachments } from '@/lib/ticketAttachments'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('Authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Purge stale unverified accounts on every run, independent of the monthly
  // lock below, so they never pile up. They can't log in or use the system,
  // so deleting them after a grace period is safe; cascades remove the
  // auto-created Player row. Grace period is tunable via admin settings.
  const purgeDays = await getUnverifiedGraceDays()
  const purgeCutoff = new Date(now.getTime() - purgeDays * 24 * 60 * 60 * 1000)
  const purgedUnverified = (await prisma.user.deleteMany({
    where: { emailVerified: null, createdAt: { lt: purgeCutoff } },
  })).count

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lockKey = `cron:credit_reset:${monthKey}`

  const acquired = await redis.set(lockKey, '1', 'EX', 90000, 'NX')
  if (!acquired) {
    return NextResponse.json({ skipped: true, reason: 'already ran this month', purgedUnverified }, { status: 409 })
  }

  const monthlyFreeCreditsRow = await prisma.adminSettings.findUnique({ where: { key: 'monthly_free_credits' } })
  const monthlyFreeCredits = typeof monthlyFreeCreditsRow?.value === 'number' ? monthlyFreeCreditsRow.value : 75

  await isFreeModeActive()

  const users = await prisma.user.findMany({
    select: { id: true, email: true, locale: true, monthlyCredits: true, isLifetimeFree: true },
  })

  const eligibleUsers = users.filter(u => !u.isLifetimeFree)

  await prisma.$transaction(
    eligibleUsers.flatMap(user => [
      prisma.user.update({
        where: { id: user.id },
        data: { monthlyCredits: monthlyFreeCredits },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: user.id,
          delta: monthlyFreeCredits - user.monthlyCredits,
          pool: 'monthly',
          reason: 'monthly_reset',
        },
      }),
    ])
  )

  for (const user of eligibleUsers) {
    await sendMonthlyResetEmail(user.email, monthlyFreeCredits, user.locale).catch(() => {})
  }

  const staleTickets = await prisma.ticket.findMany({
    where: { status: 'open', autoCloseAt: { lt: now } },
    select: { id: true, subject: true, user: { select: { email: true, locale: true } } },
  })

  if (staleTickets.length > 0) {
    for (const ticket of staleTickets) {
      await purgeTicketAttachments(ticket.id)
    }
    await prisma.ticket.updateMany({
      where: { id: { in: staleTickets.map(t => t.id) } },
      data: { status: 'closed', autoCloseAt: null },
    })
    for (const ticket of staleTickets) {
      await sendTicketAutoClosedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})
    }
  }

  return NextResponse.json({
    ok: true,
    reset: eligibleUsers.length,
    ticketsClosed: staleTickets.length,
    purgedUnverified,
    monthKey,
  })
}
