import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ProfileClient } from './ProfileClient'
import { ensureConnectToken, buildConnectUrl } from '@/lib/connectToken'
import { loadPersonalFeed } from '@/lib/social/loadFeed'
import { findGamePageNumber } from '@/lib/social/findGamePage'

const PER_PAGE = 10

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; game?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  const params = await searchParams

  let page = 1
  if (params.game) page = await findGamePageNumber({ targetGameId: params.game, userId: session.user.id, perPage: PER_PAGE })
  else if (params.page) page = Math.max(1, Number.parseInt(params.page, 10) || 1)

  const [user, connections, connectToken, feed] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        displayName: true,
        username: true,
        createdAt: true,
        publicProfileMode: true,
      },
    }),
    prisma.vaultConnection.findMany({
      where: { userId: session.user.id },
      include: { connectedUser: { select: { email: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    ensureConnectToken(session.user.id),
    loadPersonalFeed(session.user.id, page, PER_PAGE),
  ])
  if (!user) redirect('/en/auth/login')

  return (
    <ProfileClient
      email={user.email}
      displayName={user.displayName}
      username={user.username}
      signupMonth={user.createdAt.toISOString()}
      publicProfileMode={user.publicProfileMode as 'private' | 'stats' | 'full'}
      connectUrl={buildConnectUrl(connectToken)}
      connections={connections.map(c => ({ email: c.connectedUser.email, username: c.connectedUser.username }))}
      feed={feed}
      focusGameId={params.game ?? null}
    />
  )
}
