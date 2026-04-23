export type WinType =
  | 'points-all'
  | 'points-winner'
  | 'time'
  | 'ranking'
  | 'elimination'
  | 'winner'
  | 'cooperative'
  | 'team'
  | 'secret-mission'

export type Q1Answer = 'points-all' | 'points-winner' | 'time' | 'ranking' | 'elimination' | 'declaration'
export type Q2Answer = 'team' | 'cooperative' | 'individual'
export type Q3Answer = 'no' | 'roles' | 'missions'

export interface WizardState {
  name: string
  color: string
  icon: string
  q1: Q1Answer | null
  q2: Q2Answer | null
  q3: Q3Answer | null
  winType: WinType | null
  rolesEnabled: boolean
  winCondition: 'high' | 'low' | null
  scoreFields: string[]
  roles: string[]
  missions: string[]
  trackDifficulty: boolean
  trackTeamScores: boolean
  trackEliminationOrder: boolean
  timeUnit: 'seconds' | 'minutes' | 'mmss' | null
  description: string
  minPlayers: string
  maxPlayers: string
  scoringNotes: string
}

export const INITIAL_WIZARD_STATE: WizardState = {
  name: '',
  color: '#f5a623',
  icon: '🎲',
  q1: null,
  q2: null,
  q3: null,
  winType: null,
  rolesEnabled: false,
  winCondition: null,
  scoreFields: [],
  roles: [],
  missions: [],
  trackDifficulty: false,
  trackTeamScores: false,
  trackEliminationOrder: false,
  timeUnit: null,
  description: '',
  minPlayers: '',
  maxPlayers: '',
  scoringNotes: '',
}

export const COLORS: string[] = [
  '#e74c3c', '#e67e22', '#f5a623', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#2980b9', '#9b59b6', '#8e44ad',
  '#e91e63', '#ff5722', '#795548', '#607d8b', '#34495e',
  '#16a085', '#27ae60', '#d35400', '#c0392b', '#7f8c8d',
]

export const ICONS: string[] = [
  '🎲', '🏆', '⚔️', '🛡️', '👑', '⭐', '🗺️', '🔮',
  '🎯', '🧩', '🃏', '♟️', '🎭', '🔑', '💎', '🏹',
  '🧙', '🐉', '🌍', '🎪', '🚀', '⚓', '🌊', '🔥',
  '❄️', '🌙', '☀️', '🎸', '🎺', '🎻',
]
