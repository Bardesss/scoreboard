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

export async function createReview(input: {
  name: string
  review: string
  favoriteBoardGame: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    if (!input.name.trim()) return { success: false, error: 'Naam mag niet leeg zijn' }
    if (!input.review.trim()) return { success: false, error: 'Review mag niet leeg zijn' }
    if (!input.favoriteBoardGame.trim()) return { success: false, error: 'Favoriet bordspel mag niet leeg zijn' }

    const count = await prisma.review.count()

    await prisma.review.create({
      data: {
        name: input.name.trim(),
        review: input.review.trim(),
        favoriteBoardGame: input.favoriteBoardGame.trim(),
        order: count,
      },
    })

    revalidatePath('/admin/landing/reviews')
    return { success: true }
  } catch {
    return { success: false, error: 'Aanmaken mislukt' }
  }
}

export async function updateReview(
  id: string,
  input: {
    name: string
    review: string
    favoriteBoardGame: string
    visible: boolean
  },
): Promise<{ success: boolean }> {
  try {
    await requireAdmin()

    await prisma.review.update({
      where: { id },
      data: {
        name: input.name.trim(),
        review: input.review.trim(),
        favoriteBoardGame: input.favoriteBoardGame.trim(),
        visible: input.visible,
      },
    })

    revalidatePath('/admin/landing/reviews')
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function deleteReview(id: string): Promise<{ success: boolean }> {
  try {
    await requireAdmin()
    await prisma.review.delete({ where: { id } })
    revalidatePath('/admin/landing/reviews')
    return { success: true }
  } catch {
    return { success: false }
  }
}

export async function reorderReview(
  id: string,
  direction: 'up' | 'down',
): Promise<{ success: boolean }> {
  try {
    await requireAdmin()

    const current = await prisma.review.findUnique({ where: { id }, select: { order: true } })
    if (!current) return { success: false }

    const adjacent = await prisma.review.findFirst({
      where:
        direction === 'up'
          ? { order: { lt: current.order } }
          : { order: { gt: current.order } },
      orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
    })

    if (!adjacent) return { success: true } // already at boundary

    // Swap orders
    await prisma.$transaction([
      prisma.review.update({ where: { id }, data: { order: adjacent.order } }),
      prisma.review.update({ where: { id: adjacent.id }, data: { order: current.order } }),
    ])

    revalidatePath('/admin/landing/reviews')
    return { success: true }
  } catch {
    return { success: false }
  }
}
