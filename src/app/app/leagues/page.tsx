import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import LeaguesClient from './LeaguesClient'

export default async function LeaguesPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const [ownLeagues, borrowedLeagues] = await Promise.all([
    prisma.league.findMany({
      where: { ownerId: session.user.id },
      include: {
        gameTemplate: { select: { name: true, color: true, icon: true } },
        _count: { select: { members: true, playedGames: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.league.findMany({
      where: {
        ownerId: { not: session.user.id },
        members: { some: { player: { userId: session.user.id } } },
      },
      include: {
        gameTemplate: { select: { name: true, color: true, icon: true } },
        owner: { select: { username: true, email: true } },
        _count: { select: { members: true, playedGames: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <LeaguesClient
      ownLeagues={ownLeagues}
      borrowedLeagues={borrowedLeagues}
    />
  )
}
