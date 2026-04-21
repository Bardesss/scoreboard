'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function adminApproveGame(playedGameId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  if (session.user.role !== 'admin') return { success: false, error: 'unauthorized' }

  try {
    const playedGame = await prisma.playedGame.findUnique({
      where: { id: playedGameId },
      select: { status: true, submittedById: true },
    })

    if (!playedGame) return { success: false, error: 'notFound' }
    if (playedGame.status !== 'pending_approval') return { success: false, error: 'invalidStatus' }

    await prisma.playedGame.update({
      where: { id: playedGameId },
      data: { status: 'approved' },
    })

    await createNotification(playedGame.submittedById, 'played_game_accepted', { playedGameId })

    revalidatePath('/admin/approvals')
    return { success: true }
  } catch (error) {
    console.error('Error approving game:', error)
    return { success: false, error: 'serverError' }
  }
}

export async function adminRejectGame(playedGameId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  if (session.user.role !== 'admin') return { success: false, error: 'unauthorized' }

  try {
    const playedGame = await prisma.playedGame.findUnique({
      where: { id: playedGameId },
      select: { status: true, submittedById: true },
    })

    if (!playedGame) return { success: false, error: 'notFound' }
    if (playedGame.status !== 'pending_approval') return { success: false, error: 'invalidStatus' }

    await prisma.playedGame.update({
      where: { id: playedGameId },
      data: { status: 'rejected' },
    })

    await createNotification(playedGame.submittedById, 'played_game_rejected', { playedGameId })

    revalidatePath('/admin/approvals')
    return { success: true }
  } catch (error) {
    console.error('Error rejecting game:', error)
    return { success: false, error: 'serverError' }
  }
}
