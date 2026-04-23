import type {
  ResolverTemplate,
  ResolverInput,
  ResolverResult,
  ResolvedScoreEntry,
  ResolvedExtras,
} from './types'

function emptyExtras(): ResolvedExtras {
  return { winningMission: null, difficulty: null, teams: [], teamScores: null }
}

function blankEntry(playerId: string, score: number, isWinner: boolean): ResolvedScoreEntry {
  return { playerId, score, isWinner, role: null, team: null, rank: null, eliminationOrder: null }
}

export function resolveScoreEntries(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  switch (template.winType) {
    case 'winner':
      return resolveWinner(template, input)
    case 'secret-mission':
      return resolveSecretMission(template, input)
    case 'points-all':
      return resolvePointsAll(template, input)
    default:
      return { ok: false, error: 'missingWinner' }  // temporary — replaced in final step
  }
}

function resolvePointsAll(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  const scores = input.perPlayerScores ?? {}
  for (const pid of input.participantIds) {
    if (!(pid in scores)) return { ok: false, error: 'missingScore' }
  }
  const winnerScoreTarget = template.winCondition === 'low'
    ? Math.min(...input.participantIds.map(p => scores[p]))
    : Math.max(...input.participantIds.map(p => scores[p]))
  const entries = input.participantIds.map(pid =>
    blankEntry(pid, scores[pid], scores[pid] === winnerScoreTarget),
  )
  return { ok: true, scoreEntries: entries, extras: emptyExtras() }
}

function resolveSecretMission(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  if (!input.winnerId || !input.participantIds.includes(input.winnerId)) {
    return { ok: false, error: 'missingWinner' }
  }
  if (!input.winningMission || !template.missions.includes(input.winningMission)) {
    return { ok: false, error: 'missingMission' }
  }
  const entries = input.participantIds.map(pid =>
    blankEntry(pid, pid === input.winnerId ? 1 : 0, pid === input.winnerId),
  )
  return { ok: true, scoreEntries: entries, extras: { ...emptyExtras(), winningMission: input.winningMission } }
}

function resolveWinner(template: ResolverTemplate, input: ResolverInput): ResolverResult {
  if (!input.winnerId || !input.participantIds.includes(input.winnerId)) {
    return { ok: false, error: 'missingWinner' }
  }
  const entries = input.participantIds.map(pid => {
    const isWinner = pid === input.winnerId
    const entry = blankEntry(pid, isWinner ? 1 : 0, isWinner)
    if (template.roles.length > 0) {
      entry.role = input.perPlayerRole?.[pid] ?? null
    }
    return entry
  })
  return { ok: true, scoreEntries: entries, extras: emptyExtras() }
}
