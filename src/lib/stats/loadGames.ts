import { prisma } from '@/lib/prisma'
import type { StatsScope, DateFilter } from './types'
import { rangeToWhere } from './dateRange'
import type { CompactGameRow, VerboseGameRow, GamesPage } from '@/components/stats/PaginatedGamesTable'

export async function loadGames(
  scope: StatsScope,
  filter: DateFilter,
  page: number,
  perPage: number,
  variant: 'compact',
): Promise<GamesPage<CompactGameRow>>
export async function loadGames(
  scope: StatsScope,
  filter: DateFilter,
  page: number,
  perPage: number,
  variant: 'verbose',
): Promise<GamesPage<VerboseGameRow>>
export async function loadGames(
  scope: StatsScope,
  filter: DateFilter,
  page: number,
  perPage: number,
  variant: 'compact' | 'verbose',
): Promise<GamesPage<CompactGameRow> | GamesPage<VerboseGameRow>> {
  const dateWhere = rangeToWhere(filter)
  const where = (scope.kind === 'user'
    ? { league: { ownerId: scope.userId }, status: 'approved' as const, ...dateWhere }
    : { leagueId: scope.leagueId, status: 'approved' as const, ...dateWhere }) as never

  const viewerId = scope.kind === 'user' ? scope.userId : scope.viewerId

  const [userPlayerIds, total, rows] = await Promise.all([
    // The "me" player linked to the viewer's user account — NOT every vault player.
    // Player.userId is vault ownership and would match every player in the user's vault.
    prisma.player
      .findMany({ where: { linkedUserId: viewerId }, select: { id: true } })
      .then(ps => new Set(ps.map(p => p.id))),
    prisma.playedGame.count({ where }),
    prisma.playedGame.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { playedAt: 'desc' },
      include: {
        league: { select: { name: true, gameTemplate: { select: { name: true } } } },
        scores: {
          select: {
            playerId: true,
            score: true,
            isWinner: true,
            player: { select: { id: true, name: true } },
          },
          orderBy: { score: 'desc' },
        },
      },
    }),
  ])

  const buildUserWon = (pg: typeof rows[number]): boolean | null => {
    const userInGame = pg.scores.some(s => userPlayerIds.has(s.playerId))
    if (!userInGame) return null
    // Use isWinner — supports all win types (points-winner, points-all, time, cooperative, team, ranking).
    return pg.scores.some(s => userPlayerIds.has(s.playerId) && s.isWinner)
  }

  if (variant === 'compact') {
    const games: CompactGameRow[] = rows.map(pg => ({
      id: pg.id,
      gameName: pg.league.gameTemplate.name,
      leagueName: pg.league.name,
      playedAt: pg.playedAt.toISOString(),
      playerNames: pg.scores.map(s => s.player.name),
      userWon: buildUserWon(pg),
    }))
    return { games, total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) }
  }

  const games: VerboseGameRow[] = rows.map(pg => ({
    id: pg.id,
    gameName: pg.league.gameTemplate.name,
    leagueName: pg.league.name,
    playedAt: pg.playedAt.toISOString(),
    playerNames: pg.scores.map(s => s.player.name),
    userWon: buildUserWon(pg),
    scores: pg.scores.map(s => ({ playerName: s.player.name, score: s.score })),
    notes: pg.notes ?? null,
    shareToken: pg.shareToken ?? null,
  }))
  return { games, total, page, totalPages: Math.max(1, Math.ceil(total / perPage)) }
}
