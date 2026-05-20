'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { createNotification } from '@/lib/notifications'

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

  // A player linked to a real account has its name governed by that account's
  // display name (account settings → updateDisplayName). Block name changes
  // here; color/avatar edits stay allowed.
  if (player.linkedUserId && name !== player.name) {
    return { success: false, error: 'linked_player_name' }
  }

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

  // When linking a player who is already a member of one or more leagues, the
  // linked user has effectively been added to those leagues — let them know.
  if (vaultKeeperId !== null && vaultKeeperId !== session.user.id) {
    const leagues = await prisma.league.findMany({
      where: { members: { some: { playerId } } },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    })
    if (leagues.length > 0) {
      await createNotification(vaultKeeperId, 'league_invite', {
        fromEmail: session.user.email,
        playerName: player.name,
        leagueId: leagues[0].id,
        leagueName: leagues[0].name,
        leagueCount: leagues.length,
      })
    }
  }

  revalidatePath('/app/players')
  return { success: true }
}
