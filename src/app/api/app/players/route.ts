import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const players = await prisma.player.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, avatarSeed: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(players)
}
