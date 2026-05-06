export type StatsScope =
  | { kind: 'user'; userId: string }
  | { kind: 'league'; leagueId: string; viewerId: string }

export type Range = 'week' | 'month' | 'year' | 'all' | 'custom'

export type DateFilter = {
  range: Range
  from: Date | null    // null means no lower bound
  to: Date | null      // null means no upper bound
}

export type RankingEntry = {
  playerId: string
  name: string
  avatarSeed: string
  wins: number
  gamesPlayed: number
  winRatio: number
  isCurrentUser: boolean
}

export type TopGame = {
  name: string
  count: number
  userWinRatio: number | null
}

export type PlayDay = {
  day: number
  label: string
  count: number
}

export type LeagueStat = {
  id: string
  name: string
  playerCount: number
  sessionCount: number
  lastPlayedAt: string | null
}

export type MissionStat = {
  name: string
  count: number
}

export type FrequencyBucket = {
  label: string
  startISO: string
  count: number
}

export type HeadToHeadMatrix = {
  players: { id: string; name: string; avatarSeed: string }[]
  cells: number[][]   // cells[i][j] = games where players[i] finished above players[j]
}

export type StreakEntry = {
  playerId: string
  name: string
  avatarSeed: string
  currentStreak: number
  longestStreak: number
}

export type RecentFormRow = {
  playerId: string
  name: string
  avatarSeed: string
  isCurrentUser: boolean
  results: ('W' | 'L')[]  // newest first, max 5
}

export type ScoreRecords = {
  highest: { playerName: string; score: number; playedAt: string } | null
  highestLoss: { playerName: string; score: number; playedAt: string } | null
  averageWinner: number | null
}

export type WinTrendSeries = {
  players: { id: string; name: string; color: string }[]
  points: { gameIndex: number; [playerId: string]: number }[]  // cumulative wins per player
}

export type StatsBundle = {
  ranking: RankingEntry[]
  topGames?: TopGame[]
  leagues?: LeagueStat[]
  playDays: PlayDay[]
  missions: MissionStat[] | null
  gamesFrequency: FrequencyBucket[]
  headToHead?: HeadToHeadMatrix
  streaks?: StreakEntry[] | null
  recentForm?: RecentFormRow[] | null
  scoreRecords?: ScoreRecords
  winTrend?: WinTrendSeries | null
}

// Minimal shape of a PlayedGame row passed to aggregators (decoupled from Prisma types)
export type AggregatorGame = {
  id: string
  playedAt: Date
  winningMission: string | null
  notes: string | null
  shareToken: string | null
  league: {
    id: string
    name: string
    gameTemplate: { name: string; missions: string[] }
  }
  /**
   * Scores ordered by score descending — index 0 is the winner.
   * Aggregators (`computeRanking`, `computeTopGames`, etc.) rely on this
   * invariant. The Prisma query in `loadStats` is responsible for upholding it
   * via `orderBy: { score: 'desc' }`.
   */
  scores: {
    playerId: string
    score: number
    player: { id: string; name: string; avatarSeed: string; userId: string | null }
  }[]
}

export type AggregatorMember = {
  playerId: string
  name: string
  avatarSeed: string
  userId: string | null
}
