import type { WinType } from '@/app/app/games/new/wizard-types'

export type TimeUnit = 'seconds' | 'minutes' | 'mmss' | null

export type ResolverTemplate = {
  winType: WinType
  winCondition: 'high' | 'low' | null
  scoreFields: string[]
  roles: string[]
  missions: string[]
  trackDifficulty: boolean
  trackTeamScores: boolean
  trackEliminationOrder: boolean
  timeUnit: TimeUnit
}

/** Input shape from the log form; supersets of what older form sent. */
export type ResolverInput = {
  // participants always present
  participantIds: string[]

  // per-type inputs (only the relevant ones are populated)
  perPlayerScores?: Record<string, number>            // points-all: sum of fields per player
  winnerId?: string                                   // winner / points-winner / secret-mission / elimination (simple) / team
  winnerScore?: number                                // points-winner
  perPlayerTimeSeconds?: Record<string, number>       // time
  perPlayerRank?: Record<string, number>              // ranking
  perPlayerEliminationOrder?: Record<string, number | null>  // elimination with order (null = last standing)
  perPlayerRole?: Record<string, string | null>       // winner with rolesEnabled
  cooperativeWon?: boolean                            // cooperative
  difficulty?: string                                 // cooperative (trackDifficulty)
  teamAssignments?: Record<string, string>            // team: playerId → team name
  teams?: string[]                                    // team: team names
  winningTeam?: string                                // team
  perTeamScores?: Record<string, number>              // team (trackTeamScores)
  winningMission?: string                             // secret-mission
}

export type ResolvedScoreEntry = {
  playerId: string
  score: number
  isWinner: boolean
  role: string | null
  team: string | null
  rank: number | null
  eliminationOrder: number | null
}

export type ResolvedExtras = {
  winningMission: string | null
  difficulty: string | null
  teams: string[]
  teamScores: { name: string; score: number }[] | null
}

export type ResolverError =
  | 'missingWinner'
  | 'missingScore'
  | 'missingTime'
  | 'invalidRanks'
  | 'invalidEliminationOrder'
  | 'missingTeamAssignment'
  | 'missingWinningTeam'
  | 'missingCooperativeResult'
  | 'missingMission'

export type ResolverResult =
  | { ok: true; scoreEntries: ResolvedScoreEntry[]; extras: ResolvedExtras }
  | { ok: false; error: ResolverError }
