'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'

function makeAvatarSeed(name: string): string {
  return name.toLowerCase().trim()
}

export async function createPlayer(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { success: false, error: 'required' }

  const color = String(formData.get('color') ?? '#f5a623')

  try {
    await checkRateLimit(session.user.id, 'add_player')
    await deductCredits(session.user.id, 'add_player', { action: 'create_player' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'insufficientCredits' }
    if ((err as Error).message.startsWith('Rate limit')) return { success: false, error: 'serverError' }
    return { success: false, error: 'serverError' }
  }

  await prisma.player.create({
    data: { userId: session.user.id, name, avatarSeed: makeAvatarSeed(name), color },
  })

  revalidatePath('/app/players')
  return { success: true }
}

export async function updatePlayer(
  id: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { success: false, error: 'required' }

  const color = String(formData.get('color') ?? '#f5a623')

  const player = await prisma.player.findUnique({ where: { id } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'notFound' }

  await prisma.player.update({
    where: { id },
    data: { name, avatarSeed: makeAvatarSeed(name), color },
  })

  revalidatePath('/app/players')
  return { success: true }
}

export async function deletePlayer(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const player = await prisma.player.findUnique({ where: { id } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'notFound' }

  await prisma.player.delete({ where: { id } })
  revalidatePath('/app/players')
  return { success: true }
}

export async function linkPlayer(playerId: string, vaultKeeperId: string | null): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'notFound' }

  if (vaultKeeperId !== null) {
    const connection = await prisma.vaultConnection.findFirst({
      where: { userId: session.user.id, connectedUserId: vaultKeeperId },
    })
    if (!connection) return { success: false, error: 'notFound' }
  }

  await prisma.player.update({ where: { id: playerId }, data: { linkedUserId: vaultKeeperId } })
  revalidatePath('/app/players')
  return { success: true }
}
