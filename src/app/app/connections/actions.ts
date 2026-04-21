'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { redirect } from 'next/navigation'

export async function searchUsers(query: string) {
  const session = await auth()
  if (!session) return []
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: session.user.id } },
        {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: { id: true, email: true, username: true },
    take: 10,
  })
  return users
}

export async function sendConnectionRequest(toUserId: string) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const [existing, alreadyConnected] = await Promise.all([
    prisma.connectionRequest.findFirst({
      where: { fromUserId: session.user.id, toUserId, status: 'pending' },
    }),
    prisma.vaultConnection.findFirst({
      where: { userId: session.user.id, connectedUserId: toUserId },
    }),
  ])
  if (existing || alreadyConnected) return { error: 'alreadyConnected' }

  const request = await prisma.connectionRequest.create({
    data: {
      fromUserId: session.user.id,
      toUserId,
      context: 'player_list',
      status: 'pending',
    },
  })

  await createNotification(toUserId, 'connection_request', {
    requestId: request.id,
    fromEmail: session.user.email,
  })

  return { success: true }
}

export async function acceptConnectionRequest(requestId: string) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const req = await prisma.connectionRequest.findUnique({ where: { id: requestId } })
  if (!req || req.toUserId !== session.user.id || req.status !== 'pending') {
    return { error: 'notFound' }
  }

  await prisma.$transaction([
    prisma.connectionRequest.update({ where: { id: requestId }, data: { status: 'accepted' } }),
    prisma.vaultConnection.createMany({
      data: [
        { userId: req.fromUserId, connectedUserId: session.user.id },
        { userId: session.user.id, connectedUserId: req.fromUserId },
      ],
      skipDuplicates: true,
    }),
  ])

  await createNotification(req.fromUserId, 'connection_accepted', { fromEmail: session.user.email })

  return { success: true }
}

export async function declineConnectionRequest(requestId: string) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const req = await prisma.connectionRequest.findUnique({ where: { id: requestId } })
  if (!req || req.toUserId !== session.user.id || req.status !== 'pending') {
    return { error: 'notFound' }
  }

  await prisma.connectionRequest.update({ where: { id: requestId }, data: { status: 'declined' } })
  await createNotification(req.fromUserId, 'connection_declined', { fromEmail: session.user.email })

  return { success: true }
}

export async function disconnect(connectedUserId: string) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  await prisma.$transaction([
    prisma.vaultConnection.deleteMany({
      where: {
        OR: [
          { userId: session.user.id, connectedUserId },
          { userId: connectedUserId, connectedUserId: session.user.id },
        ],
      },
    }),
    prisma.player.updateMany({
      where: { userId: session.user.id, linkedUserId: connectedUserId },
      data: { linkedUserId: null },
    }),
    prisma.player.updateMany({
      where: { userId: connectedUserId, linkedUserId: session.user.id },
      data: { linkedUserId: null },
    }),
  ])

  return { success: true }
}
