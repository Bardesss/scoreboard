import { prisma } from '@/lib/prisma'

/**
 * Fire connection_game_logged notifications to every league member who was NOT
 * a participant in this game. Caller is responsible for only invoking this on
 * actual status transitions to 'approved'.
 */
export async function fireConnectionGameLogged(playedGameId: string): Promise<void> {
  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId },
    select: {
      id: true,
      league: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          gameTemplate: { select: { name: true } },
          members: {
            select: { player: { select: { userId: true, linkedUserId: true } } },
          },
        },
      },
      scores: {
        select: { player: { select: { userId: true, linkedUserId: true } } },
      },
    },
  })
  if (!pg) return

  const participantUserIds = new Set<string>()
  for (const s of pg.scores) {
    if (s.player.linkedUserId) participantUserIds.add(s.player.linkedUserId)
    else if (s.player.userId) participantUserIds.add(s.player.userId)
  }

  const recipientIds = new Set<string>()
  recipientIds.add(pg.league.ownerId)
  for (const m of pg.league.members) {
    if (m.player.linkedUserId) recipientIds.add(m.player.linkedUserId)
    else if (m.player.userId) recipientIds.add(m.player.userId)
  }
  for (const id of participantUserIds) recipientIds.delete(id)
  if (recipientIds.size === 0) return

  await prisma.notification.createMany({
    data: Array.from(recipientIds).map(userId => ({
      userId,
      type: 'connection_game_logged',
      meta: {
        playedGameId: pg.id,
        leagueId: pg.league.id,
        leagueName: pg.league.name,
        gameName: pg.league.gameTemplate.name,
      },
    })),
  })
}
