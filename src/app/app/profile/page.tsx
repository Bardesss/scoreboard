import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ProfileClient } from './ProfileClient'

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const [user, connections] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, username: true },
    }),
    prisma.vaultConnection.findMany({
      where: { userId: session.user.id },
      include: { connectedUser: { select: { email: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  if (!user) redirect('/en/auth/login')

  return (
    <ProfileClient
      email={user.email}
      username={user.username}
      connections={connections.map(c => ({ email: c.connectedUser.email, username: c.connectedUser.username }))}
    />
  )
}
