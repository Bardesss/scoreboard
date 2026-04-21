'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<string> {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export async function toggleLifetimeFree(userId: string): Promise<{ success: boolean }> {
  try {
    await requireAdmin()
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isLifetimeFree: true } })
    if (!user) return { success: false }
    await prisma.user.update({
      where: { id: userId },
      data: { isLifetimeFree: !user.isLifetimeFree },
    })
    revalidatePath('/admin/users')
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function toggleRequiresMfa(userId: string): Promise<{ success: boolean }> {
  try {
    await requireAdmin()
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { requiresMfa: true } })
    if (!user) return { success: false }
    await prisma.user.update({
      where: { id: userId },
      data: { requiresMfa: !user.requiresMfa },
    })
    revalidatePath('/admin/users')
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function setUserRole(
  userId: string,
  role: 'user' | 'admin',
): Promise<{ success: boolean }> {
  try {
    await requireAdmin()
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    })
    revalidatePath('/admin/users')
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function adjustCredits(
  userId: string,
  delta: number,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminId = await requireAdmin()

    if (delta === 0) {
      return { success: false, error: 'invalidDelta' }
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { permanentCredits: { increment: delta } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId,
          delta,
          reason: 'admin_adjustment',
          meta: { adminId, note: reason },
        },
      }),
    ])

    revalidatePath('/admin/users')
    return { success: true }
  } catch {
    return { success: false }
  }
}
