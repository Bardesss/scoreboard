'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type CreateGameTemplateInput = {
  name: string
  description: string
  scoringNotes: string
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
      description: input.description.trim() || null,
      scoringNotes: input.scoringNotes.trim() || null,
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
