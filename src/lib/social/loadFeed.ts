import { prisma } from '@/lib/prisma'
import { anonymizeName } from '@/lib/social/privacy'

export type FeedReaction = { emoji: string; count: number; mine: boolean }

export type FeedGame = {
  id: string
  playedAt: string
  league: { id: string; name: string }
  gameTemplate: { id: string; name: string; color: string; icon: string }
  scores: Array<{
    id: string
    playerId: string
    playerName: string
    score: number
    isWinner: boolean
    linkedUserId: string | null
  }>
  reactions: FeedReaction[]
}

export type FeedPage = {
  games: FeedGame[]
  total: number
  page: number
  totalPages: number
}

const INCLUDE = {
  league: { select: { id: true, name: true, gameTemplate: { select: { id: true, name: true, color: true, icon: true } } } },
  scores: {
    orderBy: { score: 'desc' } as const,
    select: {
      id: true,
      score: true,
      isWinner: true,
      player: {
        select: {
          id: true,
          name: true,
          linkedUserId: true,
          linkedUser: { select: { allowAppearInOthers: true } },
        },
      },
    },
  },
  reactions: { select: { emoji: true, userId: true } },
} as const

function denormalizeReactions(
  rows: Array<{ emoji: string; userId: string }>,
  viewerId: string | undefined,
): FeedReaction[] {
  const buckets = new Map<string, { count: number; mine: boolean }>()
  for (const r of rows) {
    const cur = buckets.get(r.emoji) ?? { count: 0, mine: false }
    cur.count += 1
    if (viewerId && r.userId === viewerId) cur.mine = true
    buckets.set(r.emoji, cur)
  }
  return Array.from(buckets.entries()).map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }))
}

type RawRow = {
  id: string
  playedAt: Date
  league: { id: string; name: string; gameTemplate: { id: string; name: string; color: string; icon: string } }
  scores: Array<{
    id: string
    score: number
    isWinner: boolean
    player: {
      id: string
      name: string
      linkedUserId: string | null
      linkedUser: { allowAppearInOthers: boolean } | null
    }
  }>
  reactions: Array<{ emoji: string; userId: string }>
}

function mapRow(
  row: RawRow,
  viewerId: string | undefined,
  anonymizeFor: { profileOwnerId: string } | null,
): FeedGame {
  let opponentIndex = 0
  const scores = row.scores.map(s => {
    let displayName = s.player.name
    if (anonymizeFor && s.player.linkedUserId !== anonymizeFor.profileOwnerId) {
      // Only anonymize linked-to-a-user opponents whose owner opted out.
      // Unlinked Players (no linkedUser) are local labels in the profile owner's vault — render as-is.
      if (s.player.linkedUser && !s.player.linkedUser.allowAppearInOthers) {
        displayName = anonymizeName('public', { allowAppearInOthers: false, name: s.player.name }, opponentIndex)
      }
      opponentIndex += 1
    }
    return {
      id: s.id,
      playerId: s.player.id,
      playerName: displayName,
      score: s.score,
      isWinner: s.isWinner,
      linkedUserId: s.player.linkedUserId,
    }
  })
  return {
    id: row.id,
    playedAt: row.playedAt.toISOString(),
    league: { id: row.league.id, name: row.league.name },
    gameTemplate: row.league.gameTemplate,
    scores,
    reactions: denormalizeReactions(row.reactions, viewerId),
  }
}

export async function loadPersonalFeed(
  userId: string,
  page: number,
  perPage: number = 10,
): Promise<FeedPage> {
  const where = {
    status: 'approved' as const,
    OR: [
      { league: { ownerId: userId } },
      { league: { members: { some: { player: { linkedUserId: userId } } } } },
    ],
  }
  const [rows, total] = await Promise.all([
    prisma.playedGame.findMany({
      where,
      orderBy: { playedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: INCLUDE,
    }),
    prisma.playedGame.count({ where }),
  ])
  return {
    games: rows.map(r => mapRow(r as RawRow, userId, null)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}

export async function loadPublicFeed(
  profileOwnerId: string,
  page: number,
  perPage: number = 10,
  viewerId?: string,
): Promise<FeedPage> {
  const where = {
    status: 'approved' as const,
    scores: {
      some: {
        player: {
          OR: [
            { linkedUserId: profileOwnerId },
            { userId: profileOwnerId, linkedUserId: null },
          ],
        },
      },
    },
  }
  const [rows, total] = await Promise.all([
    prisma.playedGame.findMany({
      where,
      orderBy: { playedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: INCLUDE,
    }),
    prisma.playedGame.count({ where }),
  ])
  return {
    games: rows.map(r => mapRow(r as RawRow, viewerId, { profileOwnerId })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}
