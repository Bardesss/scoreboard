'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<void> {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    throw new Error('Unauthorized')
  }
}

export async function createDiscountCode(input: {
  code: string
  type: 'FIXED' | 'PERCENT'
  value: number
  usageLimit: number | null
  expiresAt: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    if (!input.code.trim()) {
      return { success: false, error: 'Code mag niet leeg zijn' }
    }
    if (input.value <= 0) {
      return { success: false, error: 'Waarde moet groter dan 0 zijn' }
    }
    if (input.type === 'PERCENT' && input.value > 100) {
      return { success: false, error: 'Percentage mag niet hoger dan 100 zijn' }
    }

    await prisma.discountCode.create({
      data: {
        code: input.code.trim().toUpperCase(),
        type: input.type,
        value: input.value,
        usageLimit: input.usageLimit,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    })

    revalidatePath('/admin/settings/discount-codes')
    return { success: true }
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return { success: false, error: 'Code bestaat al' }
    }
    return { success: false, error: 'Onbekende fout' }
  }
}

export async function toggleDiscountCode(id: string): Promise<{ success: boolean }> {
  try {
    await requireAdmin()
    const code = await prisma.discountCode.findUnique({ where: { id }, select: { active: true } })
    if (!code) return { success: false }
    await prisma.discountCode.update({
      where: { id },
      data: { active: !code.active },
    })
    revalidatePath('/admin/settings/discount-codes')
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function deleteDiscountCode(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const code = await prisma.discountCode.findUnique({
      where: { id },
      select: { usedCount: true },
    })
    if (!code) return { success: false, error: 'Niet gevonden' }
    if (code.usedCount > 0) {
      return { success: false, error: 'inUse' }
    }
    await prisma.discountCode.delete({ where: { id } })
    revalidatePath('/admin/settings/discount-codes')
    return { success: true }
  } catch {
    return { success: false }
  }
}
