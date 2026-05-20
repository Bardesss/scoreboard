import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import PlayersClient from './PlayersClient'

type PageProps = {
  searchParams: Promise<{ linkWith?: string; already?: string }>
}

export default async function PlayersPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const { linkWith, already } = await searchParams

  const [players, received, sent, connections] = await Promise.all([
    prisma.player.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, avatarSeed: true, linkedUserId: true, color: true, icon: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.connectionRequest.findMany({
      where: { toUserId: session.user.id, status: 'pending' },
      include: { fromUser: { select: { email: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.connectionRequest.findMany({
      where: { fromUserId: session.user.id, status: 'pending' },
      include: { toUser: { select: { email: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vaultConnection.findMany({
      where: { userId: session.user.id },
      include: { connectedUser: { select: { id: true, email: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // If a linkWith param points to a real connection of mine, surface it to the client
  const conns = connections.map(c => ({ id: c.connectedUserId, email: c.connectedUser.email, username: c.connectedUser.username }))
  const linkWithValid = linkWith && conns.some(c => c.id === linkWith) ? linkWith : null

  return (
    <PlayersClient
      players={players}
      vaultKeeperId={session.user.id}
      received={received.map(r => ({ id: r.id, fromEmail: r.fromUser.email, fromUsername: r.fromUser.username }))}
      sent={sent.map(s => ({ id: s.id, toEmail: s.toUser?.email ?? '', toUsername: s.toUser?.username ?? null }))}
      connections={conns}
      linkWith={linkWithValid}
      alreadyConnected={already === '1'}
    />
  )
}
