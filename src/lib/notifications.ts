import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type NotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'connection_declined'
  | 'league_invite'
  | 'league_invite_accepted'
  | 'played_game_pending'
  | 'played_game_accepted'
  | 'played_game_rejected'

export async function createNotification(
  userId: string,
  type: NotificationType,
  meta?: Prisma.InputJsonValue
) {
  await prisma.notification.create({ data: { userId, type, meta } })
}
