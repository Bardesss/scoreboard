import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import PlayersClient from './PlayersClient'

export default async function PlayersPage() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const [players] = await Promise.all([
    prisma.player.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    }),
    getTranslations({ locale: session.user.locale ?? 'en', namespace: 'app.players' }),
  ])

  return <PlayersClient players={players} />
}
