import { prisma } from '@/lib/prisma'

// The set of optional emails users can opt out of. Verification + password
// reset are transactional and not on this list — they always send.
export const EMAIL_PREFERENCE_KEYS = [
  'connection_request',
  'connection_accepted',
  'connection_declined',
  'played_game_approved',
  'played_game_rejected',
  'low_credit_warning',
  'monthly_reset',
  'ticket_replied',
  'ticket_closed',
  'connection_game_logged',
  'reaction_received',
] as const

// Keys that default to OFF (opt-in). Absence in stored prefs means disabled.
const EMAIL_OPT_IN_KEYS: ReadonlySet<string> = new Set([
  'connection_game_logged',
  'reaction_received',
])

export type EmailPreferenceKey = (typeof EMAIL_PREFERENCE_KEYS)[number]

export type EmailPreferences = Partial<Record<EmailPreferenceKey, boolean>>

// Missing keys default to true for opt-out keys (standard), or false for
// opt-in keys (connection_game_logged, reaction_received).
export function isEmailEnabled(prefs: EmailPreferences | null | undefined, key: EmailPreferenceKey): boolean {
  const defaultEnabled = !EMAIL_OPT_IN_KEYS.has(key)
  if (!prefs) return defaultEnabled
  const v = prefs[key]
  if (v === undefined) return defaultEnabled
  return v !== false
}

export async function shouldSendEmailTo(userId: string, key: EmailPreferenceKey): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailPreferences: true },
  })
  return isEmailEnabled(user?.emailPreferences as EmailPreferences | null, key)
}

export function readPreferences(raw: unknown): EmailPreferences {
  if (!raw || typeof raw !== 'object') return {}
  const out: EmailPreferences = {}
  for (const key of EMAIL_PREFERENCE_KEYS) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v === 'boolean') out[key] = v
  }
  return out
}
