import { prisma } from '@/lib/prisma'

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
      player: { select: { id: true, name: true, linkedUserId: true } },
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

function mapRow(
  row: {
    id: string
    playedAt: Date
    league: { id: string; name: string; gameTemplate: { id: string; name: string; color: string; icon: string } }
    scores: Array<{ id: string; score: number; isWinner: boolean; player: { id: string; name: string; linkedUserId: string | null } }>
    reactions: Array<{ emoji: string; userId: string }>
  },
  viewerId: string | undefined,
): FeedGame {
  return {
    id: row.id,
    playedAt: row.playedAt.toISOString(),
    league: { id: row.league.id, name: row.league.name },
    gameTemplate: row.league.gameTemplate,
    scores: row.scores.map(s => ({
      id: s.id,
      playerId: s.player.id,
      playerName: s.player.name,
      score: s.score,
      isWinner: s.isWinner,
      linkedUserId: s.player.linkedUserId,
    })),
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
    games: rows.map(r => mapRow(r as never, userId)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  }
}
