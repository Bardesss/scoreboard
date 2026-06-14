import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })

type SessionUser = { id: string; email: string; role: string; locale: string; totpEnabled: boolean; requiresMfa: boolean }

function toSessionUser(u: { id: string; email: string; role: string; locale: string; totpEnabled: boolean; requiresMfa: boolean }): SessionUser {
  return { id: u.id, email: u.email, role: u.role, locale: u.locale, totpEnabled: u.totpEnabled, requiresMfa: u.requiresMfa }
}

export async function authorizeCredentials(
  credentials: Partial<Record<'email' | 'password' | 'totpVerifiedToken', unknown>>,
): Promise<SessionUser | null> {
  // Path A: one-time token minted only after a successful TOTP challenge.
  if (credentials.totpVerifiedToken) {
    const userId = await redis.get(`totp_verified:${credentials.totpVerifiedToken as string}`)
    if (!userId) return null
    await redis.del(`totp_verified:${credentials.totpVerifiedToken as string}`)
    const user = await prisma.user.findUnique({ where: { id: userId as string } })
    if (!user) return null
    return toSessionUser(user)
  }

  // Path B: raw email + password. Must REFUSE MFA accounts (they may only use Path A).
  const email = (credentials.email as string | undefined)?.trim().toLowerCase()
  if (email) {
    // Fail-open email-keyed lockout: 10 attempts / 15 min, independent of IP.
    try {
      const key = `loginfail:${email}`
      const hits = await redis.incr(key)
      if (hits === 1) await redis.expire(key, 15 * 60)
      if (hits > 10) return null
    } catch { /* redis down → don't block logins */ }
  }

  const parsed = loginSchema.safeParse(credentials)
  if (!parsed.success) return null

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!user || !user.emailVerified) return null

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!valid) return null

  if (user.totpEnabled || user.requiresMfa) return null

  try { if (email) await redis.del(`loginfail:${email}`) } catch { /* ignore */ }
  return toSessionUser(user)
}
