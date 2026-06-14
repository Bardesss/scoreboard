'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { checkUserRateLimit } from '@/lib/credits'

export type RedeemResult =
  | { success: true; creditsAdded: number; newPermanent: number }
  | { error: 'notFound' | 'inactive' | 'expired' | 'exhausted' | 'alreadyRedeemed' | 'percentNotSupported' | 'rateLimited' | 'unknown' }

// Sentinel thrown inside the transaction to surface a specific user-facing
// error code from the caller's try/catch.
class RedemptionAbort extends Error {
  constructor(public readonly code: 'exhausted') { super(code) }
}

export async function redeemDiscountCode(rawCode: string): Promise<RedeemResult> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  // Throttle: block brute-force guessing of valid discount codes.
  if (!(await checkUserRateLimit(session.user.id, 'redeem_code', 10, 60 * 60))) {
    return { error: 'rateLimited' }
  }

  const code = rawCode.trim().toUpperCase()
  if (!code) return { error: 'notFound' }

  // First pass — surface the cheap, deterministic errors with friendly messages
  // before we open a transaction. The transaction below still re-checks
  // exhaustion atomically (TOCTOU-safe) and uses the unique constraint to
  // block second-redemption by the same user.
  const dc = await prisma.discountCode.findUnique({ where: { code } })
  if (!dc) return { error: 'notFound' }
  if (!dc.active) return { error: 'inactive' }
  if (dc.expiresAt && dc.expiresAt.getTime() < Date.now()) return { error: 'expired' }
  if (dc.type === 'PERCENT') return { error: 'percentNotSupported' }

  try {
    const newPermanent = await prisma.$transaction(async tx => {
      // Atomic conditional increment — only succeeds if the code is still
      // active, not expired, and (when capped) under its usageLimit. Without
      // this, concurrent redeemers could each pass an earlier read of
      // usedCount and collectively blow past the cap.
      const guard: Prisma.DiscountCodeWhereInput = {
        id: dc.id,
        active: true,
        ...(dc.expiresAt ? { expiresAt: { gt: new Date() } } : {}),
        ...(dc.usageLimit !== null ? { usedCount: { lt: dc.usageLimit } } : {}),
      }
      const updated = await tx.discountCode.updateMany({
        where: guard,
        data: { usedCount: { increment: 1 } },
      })
      if (updated.count === 0) throw new RedemptionAbort('exhausted')

      // Record this user's redemption. Unique constraint on
      // (userId, discountCodeId) makes the second attempt by the same user
      // raise P2002 — caught below and surfaced as alreadyRedeemed. The
      // earlier updateMany has already incremented usedCount, but it'll be
      // rolled back when this throws.
      await tx.discountRedemption.create({
        data: { userId: session.user.id, discountCodeId: dc.id },
      })

      // Credit the user and write the ledger row.
      const user = await tx.user.update({
        where: { id: session.user.id },
        data: { permanentCredits: { increment: dc.value } },
        select: { permanentCredits: true },
      })
      await tx.creditTransaction.create({
        data: {
          userId: session.user.id,
          delta: dc.value,
          pool: 'permanent',
          reason: 'discount_code',
          meta: { code: dc.code },
        },
      })

      return user.permanentCredits
    })

    revalidatePath('/app/credits')
    return { success: true, creditsAdded: dc.value, newPermanent }
  } catch (e) {
    if (e instanceof RedemptionAbort) return { error: e.code }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'alreadyRedeemed' }
    }
    return { error: 'unknown' }
  }
}
