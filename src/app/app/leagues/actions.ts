'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type CreateLeagueInput = {
  name: string
  description: string
  gameTemplateId: string
  playerIds: string[]
}

export async function createLeague(
  input: CreateLeagueInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = input.name.trim()
  if (!name) return { success: false, error: 'errors.required' }
  if (!input.gameTemplateId) return { success: false, error: 'errors.required' }

  const template = await prisma.gameTemplate.findUnique({ where: { id: input.gameTemplateId } })
  if (!template || template.userId !== session.user.id) return { success: false, error: 'errors.notFound' }

  try {
    await checkRateLimit(session.user.id, 'league')
    await deductCredits(session.user.id, 'league', { action: 'create_league' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'errors.insufficientCredits' }
    return { success: false, error: 'errors.serverError' }
  }

  const league = await prisma.league.create({
    data: {
      ownerId: session.user.id,
      name,
      description: input.description.trim() || null,
      gameTemplateId: input.gameTemplateId,
    },
  })

  if (input.playerIds.length > 0) {
    const ownedPlayers = await prisma.player.findMany({
      where: { id: { in: input.playerIds }, userId: session.user.id },
      select: { id: true },
    })
    if (ownedPlayers.length > 0) {
      await prisma.leagueMember.createMany({
        data: ownedPlayers.map(p => ({ leagueId: league.id, playerId: p.id })),
        skipDuplicates: true,
      })
    }
  }

  revalidatePath('/app/leagues')
  return { success: true, id: league.id }
}

export async function deleteLeague(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const league = await prisma.league.findUnique({ where: { id } })
  if (!league || league.ownerId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.league.delete({ where: { id } })
  revalidatePath('/app/leagues')
  return { success: true }
}
