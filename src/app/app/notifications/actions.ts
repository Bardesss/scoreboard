'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function markAllNotificationsRead() {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  })
}

export async function markNotificationRead(id: string) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id, read: false },
    data: { read: true },
  })
  revalidatePath('/app/notifications')
}

export async function deleteNotification(id: string) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  await prisma.notification.deleteMany({
    where: { id, userId: session.user.id },
  })
  revalidatePath('/app/notifications')
}
