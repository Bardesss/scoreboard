import { prisma } from '@/lib/prisma'

export const DEFAULT_UNVERIFIED_GRACE_DAYS = 7

/**
 * Number of days an unverified account survives before the cron purge removes
 * it. This is the single source of truth shared by the verification token TTL,
 * the verification email copy, and the purge job — so the link stays valid for
 * exactly as long as the account exists. Admin-tunable via the
 * `unverified_purge_days` setting; falls back to the default when unset or
 * invalid (<= 0).
 */
export async function getUnverifiedGraceDays(): Promise<number> {
  const row = await prisma.adminSettings.findUnique({ where: { key: 'unverified_purge_days' } })
  return typeof row?.value === 'number' && row.value > 0 ? row.value : DEFAULT_UNVERIFIED_GRACE_DAYS
}
