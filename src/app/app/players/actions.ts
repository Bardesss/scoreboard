'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function makeAvatarSeed(name: string): string {
  return name.toLowerCase().trim()
}

export async function createPlayer(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { success: false, error: 'errors.required' }

  await prisma.player.create({
    data: { userId: session.user.id, name, avatarSeed: makeAvatarSeed(name) },
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
  if (!name) return { success: false, error: 'errors.required' }

  const player = await prisma.player.findUnique({ where: { id } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.player.update({
    where: { id },
    data: { name, avatarSeed: makeAvatarSeed(name) },
  })

  revalidatePath('/app/players')
  return { success: true }
}

export async function deletePlayer(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const player = await prisma.player.findUnique({ where: { id } })
  if (!player || player.userId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.player.delete({ where: { id } })
  revalidatePath('/app/players')
  return { success: true }
}
