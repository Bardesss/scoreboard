import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import type { StatsScope, DateFilter, StatsBundle, AggregatorGame } from './types'
import { rangeToWhere, cacheSuffix } from './dateRange'
import { computeRanking } from './ranking'
import { computeTopGames } from './topGames'
import { computePlayDays } from './playDays'
import { computeLeagues } from './leagues'
import { computeMissionStats } from './missions'
import { computeGamesFrequency } from './gamesFrequency'
import { computeHeadToHead } from './headToHead'
import { computeStreaks } from './streaks'
import { computeRecentForm } from './recentForm'
import { computeScoreRecords } from './scoreRecords'
import { computeWinTrend } from './winTrend'

function cacheKey(scope: StatsScope, filter: DateFilter): string | null {
  const suffix = cacheSuffix(filter)
  if (suffix === null) return null
  if (scope.kind === 'user') return `cache:stats:user:${scope.userId}:${suffix}`
  return `cache:stats:league:${scope.leagueId}:${suffix}`
}

async function fetchGames(scope: StatsScope, filter: DateFilter): Promise<AggregatorGame[]> {
  const dateWhere = rangeToWhere(filter)
  const where = scope.kind === 'user'
    ? { league: { ownerId: scope.userId }, status: 'approved', ...dateWhere }
    : { leagueId: scope.leagueId, status: 'approved', ...dateWhere }

  const rows = await prisma.playedGame.findMany({
    where: where as never,
    include: {
      league: {
        select: {
          id: true, name: true,
          gameTemplate: { select: { name: true, missions: true } },
        },
      },
      scores: {
        select: {
          playerId: true,
          score: true,
          isWinner: true,
          player: { select: { id: true, name: true, avatarSeed: true, linkedUserId: true } },
        },
        orderBy: { score: 'desc' },
      },
    },
    orderBy: { playedAt: 'asc' },
  })

  return rows.map(r => ({
    id: r.id,
    playedAt: r.playedAt,
    winningMission: r.winningMission ?? null,
    notes: r.notes ?? null,
    shareToken: r.shareToken ?? null,
    league: {
      id: r.league.id,
      name: r.league.name,
      gameTemplate: { name: r.league.gameTemplate.name, missions: r.league.gameTemplate.missions },
    },
    scores: r.scores.map(s => ({
      playerId: s.playerId,
      score: s.score,
      isWinner: s.isWinner,
      player: {
        id: s.player.id,
        name: s.player.name,
        avatarSeed: s.player.avatarSeed,
        linkedUserId: s.player.linkedUserId,
      },
    })),
  }))
}

export async function loadStats(
  scope: StatsScope,
  filter: DateFilter,
  locale: 'nl' | 'en' = 'nl',
): Promise<StatsBundle> {
  const key = cacheKey(scope, filter)
  if (key) {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as StatsBundle
  }

  const games = await fetchGames(scope, filter)
  const viewerId = scope.kind === 'user' ? scope.userId : scope.viewerId

  let bundle: StatsBundle
  if (scope.kind === 'user') {
    const allLeagues = await prisma.league.findMany({
      where: { ownerId: scope.userId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    })
    bundle = {
      ranking: computeRanking(games, viewerId),
      topGames: computeTopGames(games, viewerId),
      leagues: computeLeagues(
        allLeagues.map(l => ({ id: l.id, name: l.name, playerCount: l._count.members })),
        games,
      ),
      playDays: computePlayDays(games, locale),
      missions: computeMissionStats(games),
      gamesFrequency: computeGamesFrequency(games, filter),
    }
  } else {
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: scope.leagueId },
      include: { player: { select: { id: true, name: true, avatarSeed: true, linkedUserId: true } } },
    })
    const memberSummaries = members.map(m => ({
      playerId: m.player.id,
      name: m.player.name,
      avatarSeed: m.player.avatarSeed,
      linkedUserId: m.player.linkedUserId,
    }))
    const hideHeadToHead = members.length > 8
    bundle = {
      ranking: computeRanking(games, viewerId),
      playDays: computePlayDays(games, locale),
      missions: computeMissionStats(games),
      gamesFrequency: computeGamesFrequency(games, filter),
      headToHead: hideHeadToHead ? undefined : computeHeadToHead(games, memberSummaries),
      streaks: games.length >= 3 ? computeStreaks(games, memberSummaries) : null,
      recentForm: games.length >= 3 ? computeRecentForm(games, memberSummaries, viewerId) : null,
      scoreRecords: computeScoreRecords(games),
      winTrend: games.length >= 3 ? computeWinTrend(games, memberSummaries) : null,
    }
  }

  if (key) await redis.setex(key, 300, JSON.stringify(bundle))
  return bundle
}
