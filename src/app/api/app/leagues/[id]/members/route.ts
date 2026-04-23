import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      gameTemplate: {
        select: {
          winType: true,
          winCondition: true,
          scoreFields: true,
          roles: true,
          missions: true,
          minPlayers: true,
          maxPlayers: true,
          trackDifficulty: true,
          trackTeamScores: true,
          trackEliminationOrder: true,
          timeUnit: true,
        },
      },
    },
  })
  if (!league || league.ownerId !== session.user.id) return NextResponse.json([], { status: 403 })

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: id },
    include: { player: { select: { id: true, name: true, userId: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    members,
    template: league.gameTemplate,
  })
}
