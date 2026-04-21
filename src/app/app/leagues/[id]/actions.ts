'use server'
import crypto from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/mail'
import { playedGameApprovedEmail, playedGameRejectedEmail } from '@/lib/emailTemplates'

type LogPlayedGameInput = {
  playedAt: Date
  notes: string
  winningMission?: string
  scores: { playerId: string; score: number }[]
}

export async function logPlayedGame(
  leagueId: string,
  input: LogPlayedGameInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league || league.ownerId !== session.user.id) return { success: false, error: 'notFound' }

  try {
    await checkRateLimit(session.user.id, 'played_game')
    await deductCredits(session.user.id, 'played_game', { leagueId, action: 'log_played_game' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'insufficientCredits' }
    return { success: false, error: 'serverError' }
  }

  const [playedGame] = await prisma.$transaction([
    prisma.playedGame.create({
      data: {
        leagueId,
        submittedById: session.user.id,
        playedAt: input.playedAt,
        notes: input.notes.trim() || null,
        winningMission: input.winningMission?.trim() || null,
        status: 'approved',
        shareToken: crypto.randomUUID(),
        scores: {
          create: input.scores.map(s => ({ playerId: s.playerId, score: s.score })),
        },
      },
    }),
  ])

  await redis.del(`cache:dashboard:${session.user.id}`)
  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true, id: playedGame.id }
}

export async function approvePlayedGame(playedGameId: string) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId },
    include: { league: { select: { ownerId: true, name: true } } },
  })
  if (!pg || pg.league.ownerId !== session.user.id) return { error: 'notFound' }
  if (pg.status !== 'pending_approval') return { error: 'notFound' }

  await prisma.playedGame.update({ where: { id: playedGameId }, data: { status: 'approved' } })
  await redis.del(`cache:dashboard:${session.user.id}`)
  await redis.del(`cache:dashboard:${pg.submittedById}`)
  await createNotification(pg.submittedById, 'played_game_accepted', { playedGameId })

  // Fire-and-forget email to the submitter
  try {
    const submitter = await prisma.user.findUnique({
      where: { id: pg.submittedById },
      select: { email: true, locale: true },
    })
    if (submitter?.email) {
      const tpl = playedGameApprovedEmail(submitter.locale ?? 'en', pg.league.name)
      sendEmail(submitter.email, tpl.subject, tpl.html).catch(() => {})
    }
  } catch { /* email failure must not break the action */ }

  revalidatePath(`/app/leagues/${pg.leagueId}`)
  return { success: true }
}

export async function rejectPlayedGame(playedGameId: string) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId },
    include: { league: { select: { ownerId: true, name: true } } },
  })
  if (!pg || pg.league.ownerId !== session.user.id) return { error: 'notFound' }
  if (pg.status !== 'pending_approval') return { error: 'notFound' }

  await prisma.playedGame.update({ where: { id: playedGameId }, data: { status: 'rejected' } })
  await redis.del(`cache:dashboard:${session.user.id}`)
  await redis.del(`cache:dashboard:${pg.submittedById}`)
  await createNotification(pg.submittedById, 'played_game_rejected', { playedGameId })

  // Fire-and-forget email to the submitter
  try {
    const submitter = await prisma.user.findUnique({
      where: { id: pg.submittedById },
      select: { email: true, locale: true },
    })
    if (submitter?.email) {
      const tpl = playedGameRejectedEmail(submitter.locale ?? 'en', pg.league.name)
      sendEmail(submitter.email, tpl.subject, tpl.html).catch(() => {})
    }
  } catch { /* email failure must not break the action */ }

  revalidatePath(`/app/leagues/${pg.leagueId}`)
  return { success: true }
}

type EditPlayedGameInput = {
  playedAt: Date
  notes: string
  winningMission?: string
  scores: { playerId: string; score: number }[]
}

export async function editPlayedGame(
  playedGameId: string,
  leagueId: string,
  input: EditPlayedGameInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId, leagueId },
    include: { league: { select: { ownerId: true } } },
  })
  if (!pg || pg.league.ownerId !== session.user.id) return { success: false, error: 'notFound' }

  await prisma.$transaction([
    prisma.scoreEntry.deleteMany({ where: { playedGameId } }),
    prisma.playedGame.update({
      where: { id: playedGameId },
      data: {
        playedAt: input.playedAt,
        notes: input.notes.trim() || null,
        winningMission: input.winningMission?.trim() || null,
      },
    }),
    prisma.scoreEntry.createMany({
      data: input.scores.map(s => ({ playedGameId, playerId: s.playerId, score: s.score })),
    }),
  ])

  await redis.del(`cache:dashboard:${session.user.id}`)
  if (pg.submittedById !== session.user.id) await redis.del(`cache:dashboard:${pg.submittedById}`)
  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true }
}

export async function deletePlayedGame(
  playedGameId: string,
  leagueId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId, leagueId },
    include: { league: { select: { ownerId: true } } },
  })
  if (!pg || pg.league.ownerId !== session.user.id) return { success: false, error: 'notFound' }

  await prisma.playedGame.delete({ where: { id: playedGameId } })
  await redis.del(`cache:dashboard:${session.user.id}`)
  if (pg.submittedById !== session.user.id) await redis.del(`cache:dashboard:${pg.submittedById}`)
  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true }
}
