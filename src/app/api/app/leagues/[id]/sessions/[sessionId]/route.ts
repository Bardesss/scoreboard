import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { id, sessionId } = await params
  const session = await auth()
  if (!session) return NextResponse.json(null, { status: 401 })

  const league = await prisma.league.findUnique({ where: { id } })
  if (!league || league.ownerId !== session.user.id) return NextResponse.json(null, { status: 403 })

  const pg = await prisma.playedGame.findUnique({
    where: { id: sessionId, leagueId: id },
    include: { scores: { include: { player: { select: { id: true } } } } },
  })
  if (!pg) return NextResponse.json(null, { status: 404 })

  const d = pg.playedAt
  const pad = (n: number) => String(n).padStart(2, '0')
  const playedAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

  const winner = pg.scores.find(s => s.isWinner)

  return NextResponse.json({
    playedAt: playedAtLocal,
    notes: pg.notes ?? '',
    winningMission: pg.winningMission ?? '',
    difficulty: pg.difficulty ?? '',
    teams: pg.teams,
    teamScores: pg.teamScores,
    participantIds: pg.scores.map(s => s.playerId),
    winnerId: winner?.playerId ?? '',
    scores: pg.scores.map(s => ({
      playerId: s.playerId,
      score: s.score,
      isWinner: s.isWinner,
      role: s.role,
      team: s.team,
      rank: s.rank,
      eliminationOrder: s.eliminationOrder,
    })),
  })
}
