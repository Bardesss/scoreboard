'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { isAllowedReaction } from '@/lib/reactions'
import { redirect } from 'next/navigation'

type Result =
  | { reactions: Array<{ emoji: string; count: number; mine: boolean }> }
  | { error: 'notFound' | 'notAllowed' | 'invalidEmoji' | 'rateLimited' }

const RATE_LIMIT_TTL_SECONDS = 1

export async function toggleReaction(playedGameId: string, emoji: string): Promise<Result> {
  if (!isAllowedReaction(emoji)) return { error: 'invalidEmoji' }

  const session = await auth()
  if (!session) redirect('/en/auth/login')
  const userId = session.user.id

  // Rate limit per-user per-game per-emoji.
  const key = `react:${userId}:${playedGameId}:${emoji}`
  const hits = await redis.incr(key)
  if (hits === 1) await redis.expire(key, RATE_LIMIT_TTL_SECONDS)
  if (hits > 1) return { error: 'rateLimited' }

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId },
    select: { id: true, status: true, league: { select: { id: true, ownerId: true } } },
  })
  if (!pg || pg.status !== 'approved') return { error: 'notFound' }

  const isOwner = pg.league.ownerId === userId
  if (!isOwner) {
    const memberCount = await prisma.leagueMember.count({
      where: { leagueId: pg.league.id, player: { linkedUserId: userId } },
    })
    if (memberCount === 0) return { error: 'notAllowed' }
  }

  const existing = await prisma.playedGameReaction.findUnique({
    where: { playedGameId_userId_emoji: { playedGameId, userId, emoji } },
  })

  const wasCreating = !existing
  if (existing) {
    await prisma.playedGameReaction.delete({ where: { id: existing.id } })
  } else {
    await prisma.playedGameReaction.create({ data: { playedGameId, userId, emoji } })
  }

  // Re-aggregate reactions for the response.
  const allRows = await prisma.playedGameReaction.findMany({
    where: { playedGameId },
    select: { emoji: true, userId: true },
  })
  const buckets = new Map<string, { count: number; mine: boolean }>()
  for (const r of allRows) {
    const cur = buckets.get(r.emoji) ?? { count: 0, mine: false }
    cur.count += 1
    if (r.userId === userId) cur.mine = true
    buckets.set(r.emoji, cur)
  }
  const reactions = Array.from(buckets.entries()).map(([e, v]) => ({ emoji: e, count: v.count, mine: v.mine }))

  // Side effect: notify participants when an outsider reacts (creation only, not deletion).
  if (wasCreating) {
    const participants = await prisma.playedGame.findUnique({
      where: { id: playedGameId },
      select: {
        scores: {
          select: { player: { select: { userId: true, linkedUserId: true } } },
        },
        league: { select: { name: true, gameTemplate: { select: { name: true } } } },
      },
    })
    const participantUserIds = new Set<string>()
    for (const s of participants?.scores ?? []) {
      if (s.player.linkedUserId) participantUserIds.add(s.player.linkedUserId)
      else if (s.player.userId) participantUserIds.add(s.player.userId)
    }
    if (!participantUserIds.has(userId) && participantUserIds.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(participantUserIds).map(targetUserId => ({
          userId: targetUserId,
          type: 'reaction_received',
          meta: {
            playedGameId,
            emoji,
            actorUserId: userId,
            actorEmail: session.user.email,
            leagueName: participants?.league.name ?? null,
            gameName: participants?.league.gameTemplate.name ?? null,
          },
        })),
      })
    }
  }

  return { reactions }
}
