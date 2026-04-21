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
        select: { winType: true, missions: true, scoreFields: true, minPlayers: true, maxPlayers: true },
      },
    },
  })
  if (!league || league.ownerId !== session.user.id) return NextResponse.json([], { status: 403 })

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: id },
    include: { player: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    members,
    winType: league.gameTemplate.winType,
    missions: league.gameTemplate.missions,
    scoreFields: league.gameTemplate.scoreFields,
    minPlayers: league.gameTemplate.minPlayers,
    maxPlayers: league.gameTemplate.maxPlayers,
  })
}
