import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ConnectionsClient } from './ConnectionsClient'

export default async function ConnectionsPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const [received, sent, connections] = await Promise.all([
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

  return (
    <ConnectionsClient
      received={received.map(r => ({ id: r.id, fromEmail: r.fromUser.email, fromUsername: r.fromUser.username }))}
      sent={sent.map(s => ({ id: s.id, toEmail: s.toUser?.email ?? '', toUsername: s.toUser?.username ?? null }))}
      connections={connections.map(c => ({ id: c.connectedUserId, email: c.connectedUser.email, username: c.connectedUser.username }))}
    />
  )
}
