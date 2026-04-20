import type { Q1Answer, Q2Answer, Q3Answer, WinType } from './wizard-types'

interface WinTypeQuestions {
  q1: Q1Answer | null
  q2: Q2Answer | null
  q3: Q3Answer | null
}

interface ResolvedWinType {
  winType: WinType | null
  rolesEnabled: boolean
  isComplete: boolean
}

export function resolveWinType(q: WinTypeQuestions): ResolvedWinType {
  if (q.q1 === null) return { winType: null, rolesEnabled: false, isComplete: false }

  if (q.q1 !== 'declaration') {
    return { winType: q.q1, rolesEnabled: false, isComplete: true }
  }

  if (q.q2 === null) return { winType: null, rolesEnabled: false, isComplete: false }
  if (q.q2 === 'team') return { winType: 'team', rolesEnabled: false, isComplete: true }
  if (q.q2 === 'cooperative') return { winType: 'cooperative', rolesEnabled: false, isComplete: true }

  if (q.q3 === null) return { winType: null, rolesEnabled: false, isComplete: false }
  if (q.q3 === 'no') return { winType: 'winner', rolesEnabled: false, isComplete: true }
  if (q.q3 === 'roles') return { winType: 'winner', rolesEnabled: true, isComplete: true }
  return { winType: 'secret-mission', rolesEnabled: false, isComplete: true }
}
