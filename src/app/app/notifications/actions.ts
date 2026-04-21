'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function markAllNotificationsRead() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  })
}
