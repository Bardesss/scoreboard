import { prisma } from '@/lib/prisma'

export async function findGamePageNumber({
  targetGameId,
  userId,
  perPage,
}: {
  targetGameId: string
  userId: string
  perPage: number
}): Promise<number> {
  const target = await prisma.playedGame.findUnique({
    where: { id: targetGameId },
    select: { playedAt: true },
  })
  if (!target) return 1
  const newerCount = await prisma.playedGame.count({
    where: {
      status: 'approved',
      playedAt: { gt: target.playedAt },
      OR: [
        { league: { ownerId: userId } },
        { league: { members: { some: { player: { linkedUserId: userId } } } } },
      ],
    },
  })
  return Math.floor(newerCount / perPage) + 1
}
