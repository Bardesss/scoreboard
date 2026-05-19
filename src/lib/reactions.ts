export const ALLOWED_REACTIONS = ['🔥', '👏', '🎲', '😅', '💪'] as const
export type Reaction = typeof ALLOWED_REACTIONS[number]

export function isAllowedReaction(value: unknown): value is Reaction {
  return typeof value === 'string' && (ALLOWED_REACTIONS as readonly string[]).includes(value)
}
