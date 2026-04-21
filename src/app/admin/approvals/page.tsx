import { prisma } from '@/lib/prisma'
import ApprovalsClient from './ApprovalsClient'

export default async function ApprovalsPage() {
  const pending = await prisma.playedGame.findMany({
    where: { status: 'pending_approval' },
    include: {
      league: { select: { id: true, name: true } },
      submittedBy: { select: { email: true, username: true } },
      scores: { include: { player: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const serialized = pending.map(pg => ({
    id: pg.id,
    league: pg.league,
    submittedBy: pg.submittedBy,
    playedAt: pg.playedAt.toISOString(),
    notes: pg.notes,
    scores: pg.scores.map(s => ({
      id: s.id,
      playerName: s.player.name,
      score: s.score,
    })),
  }))

  return <ApprovalsClient games={serialized} />
}
