'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type LogPlayedGameInput = {
  playedAt: Date
  notes: string
  scores: { playerId: string; score: number }[]
}

export async function logPlayedGame(
  leagueId: string,
  input: LogPlayedGameInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.ownerId !== session.user.id) return { success: false, error: 'errors.notFound' }

  try {
    await checkRateLimit(session.user.id, 'played_game')
    await deductCredits(session.user.id, 'played_game', { leagueId, action: 'log_played_game' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'errors.insufficientCredits' }
    return { success: false, error: 'errors.serverError' }
  }

  const [playedGame] = await prisma.$transaction([
    prisma.playedGame.create({
      data: {
        leagueId,
        submittedById: session.user.id,
        playedAt: input.playedAt,
        notes: input.notes.trim() || null,
        status: 'approved',
        scores: {
          create: input.scores.map(s => ({ playerId: s.playerId, score: s.score })),
        },
      },
    }),
  ])

  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true, id: playedGame.id }
}
