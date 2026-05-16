'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type RedeemResult =
  | { success: true; creditsAdded: number; newPermanent: number }
  | { error: 'notFound' | 'inactive' | 'expired' | 'exhausted' | 'percentNotSupported' | 'unknown' }

export async function redeemDiscountCode(rawCode: string): Promise<RedeemResult> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const code = rawCode.trim().toUpperCase()
  if (!code) return { error: 'notFound' }

  const dc = await prisma.discountCode.findUnique({ where: { code } })
  if (!dc) return { error: 'notFound' }
  if (!dc.active) return { error: 'inactive' }
  if (dc.expiresAt && dc.expiresAt.getTime() < Date.now()) return { error: 'expired' }
  if (dc.usageLimit !== null && dc.usedCount >= dc.usageLimit) return { error: 'exhausted' }

  // PERCENT codes apply at checkout — once payments ship they'll be redeemed
  // in the checkout flow, not here. FIXED codes credit the account directly.
  if (dc.type === 'PERCENT') return { error: 'percentNotSupported' }

  try {
    const [, updated] = await prisma.$transaction([
      prisma.discountCode.update({
        where: { id: dc.id },
        data: { usedCount: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { permanentCredits: { increment: dc.value } },
        select: { permanentCredits: true },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: session.user.id,
          delta: dc.value,
          pool: 'permanent',
          reason: 'discount_code',
          meta: { code: dc.code },
        },
      }),
    ])

    revalidatePath('/app/credits')
    return { success: true, creditsAdded: dc.value, newPermanent: updated.permanentCredits }
  } catch {
    return { error: 'unknown' }
  }
}
