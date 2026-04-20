'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type CreateGameTemplateInput = {
  name: string
  color: string
  icon: string
  winType: string
  winCondition: string | null
  scoreFields: string[]
  roles: string[]
  missions: string[]
  trackDifficulty: boolean
  trackTeamScores: boolean
  timeUnit: string | null
  description: string
  minPlayers: number | null
  maxPlayers: number | null
  scoringNotes: string
  buyInEnabled: boolean
  buyInCurrency: string | null
}

export async function createGameTemplate(
  input: CreateGameTemplateInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = input.name.trim()
  if (!name) return { success: false, error: 'errors.required' }

  try {
    await checkRateLimit(session.user.id, 'game_template')
    await deductCredits(session.user.id, 'game_template', { action: 'create_game_template' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'errors.insufficientCredits' }
    if ((err as Error).message.startsWith('Rate limit')) return { success: false, error: 'errors.serverError' }
    return { success: false, error: 'errors.serverError' }
  }

  const template = await prisma.gameTemplate.create({
    data: {
      userId: session.user.id,
      name,
      color: input.color,
      icon: input.icon,
      winType: input.winType,
      winCondition: input.winCondition ?? null,
      scoreFields: input.scoreFields,
      roles: input.roles,
      missions: input.missions,
      trackDifficulty: input.trackDifficulty,
      trackTeamScores: input.trackTeamScores,
      timeUnit: input.timeUnit ?? null,
      description: input.description.trim() || null,
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      scoringNotes: input.scoringNotes.trim() || null,
      buyInEnabled: input.buyInEnabled,
      buyInCurrency: input.buyInCurrency ?? null,
    },
  })

  revalidatePath('/app/games')
  return { success: true, id: template.id }
}

export async function deleteGameTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const template = await prisma.gameTemplate.findUnique({ where: { id } })
  if (!template || template.userId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.gameTemplate.delete({ where: { id } })
  revalidatePath('/app/games')
  return { success: true }
}
