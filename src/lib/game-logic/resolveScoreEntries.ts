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
    default:
      return { ok: false, error: 'missingWinner' }  // temporary — replaced in final step
  }
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
