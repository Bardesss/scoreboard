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

export async function saveSettings(data: {
  monthly_free_credits: number
  cost_game_template: number
  cost_league: number
  cost_add_player: number
  cost_played_game: number
  low_credit_threshold: number
  free_mode_active: boolean
  free_mode_banner_nl: string
  free_mode_banner_en: string
}): Promise<{ success: boolean }> {
  try {
    await requireAdmin()

    await Promise.all(
      Object.entries(data).map(([key, value]) =>
        prisma.adminSettings.upsert({
          where: { key },
          update: { value: value as import('@prisma/client').Prisma.InputJsonValue },
          create: { key, value: value as import('@prisma/client').Prisma.InputJsonValue },
        })
      )
    )

    revalidatePath('/admin/settings')
    return { success: true }
  } catch {
    return { success: false }
  }
}
