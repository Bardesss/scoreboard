'use server'

import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { generateTOTPSecret, verifyTOTPCode, generateBackupCodes } from '@/lib/totp'
import { EMAIL_PREFERENCE_KEYS, type EmailPreferences } from '@/lib/emailPreferences'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'

type Result<T = object> =
  | ({ success: true } & T)
  | { success: false; error: string }

const VALID_LOCALES = ['en', 'nl'] as const
type Locale = (typeof VALID_LOCALES)[number]

const TOTP_SETUP_TTL = 60 * 10
const setupKey = (userId: string) => `totp_setup:${userId}`

export async function logout(): Promise<void> {
  const session = await auth()
  const locale = (session?.user.locale ?? 'en') as Locale
  await signOut({ redirectTo: `/${locale}/auth/login` })
}

export async function setLocale(locale: string): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }
  if (!VALID_LOCALES.includes(locale as Locale)) return { success: false, error: 'invalid_locale' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale },
  })

  revalidatePath('/app', 'layout')
  return { success: true }
}

export async function changePassword(formData: FormData): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }

  const current = formData.get('currentPassword') as string
  const next = formData.get('newPassword') as string
  const confirm = formData.get('confirmPassword') as string

  if (!current || !next || !confirm) return { success: false, error: 'missing_fields' }
  if (next.length < 11) return { success: false, error: 'password_too_short' }
  if (next !== confirm) return { success: false, error: 'password_mismatch' }
  if (next === current) return { success: false, error: 'password_unchanged' }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })
  if (!user) return { success: false, error: 'unauthorized' }

  const valid = await bcrypt.compare(current, user.passwordHash)
  if (!valid) return { success: false, error: 'current_password_wrong' }

  const passwordHash = await bcrypt.hash(next, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  })

  return { success: true }
}

export async function initTotpSetup(): Promise<Result<{ secret: string; uri: string; qrDataUrl: string }>> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }
  if (session.user.totpEnabled) return { success: false, error: 'already_enabled' }

  const { secret, uri } = generateTOTPSecret(session.user.email)
  await redis.setex(setupKey(session.user.id), TOTP_SETUP_TTL, secret)
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 240, margin: 1 })

  return { success: true, secret, uri, qrDataUrl }
}

export async function confirmTotpSetup(
  code: string
): Promise<Result<{ backupCodes: string[] }>> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }
  if (session.user.totpEnabled) return { success: false, error: 'already_enabled' }

  const cleaned = (code ?? '').trim()
  if (!cleaned) return { success: false, error: 'code_required' }

  const pending = await redis.get(setupKey(session.user.id))
  if (!pending) return { success: false, error: 'setup_expired' }

  if (!verifyTOTPCode(pending, cleaned)) return { success: false, error: 'invalid_code' }

  const backupCodes = generateBackupCodes()
  const hashed = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 8)))

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      totpSecret: pending,
      totpEnabled: true,
      totpBackupCodes: hashed,
    },
  })
  await redis.del(setupKey(session.user.id))

  return { success: true, backupCodes }
}

async function verifyCurrentTotp(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpBackupCodes: true },
  })
  if (!user || !user.totpSecret) return false

  const cleaned = code.trim()
  if (verifyTOTPCode(user.totpSecret, cleaned)) return true

  for (const hashed of user.totpBackupCodes) {
    if (await bcrypt.compare(cleaned, hashed)) {
      // Burn the backup code that was just used.
      await prisma.user.update({
        where: { id: userId },
        data: { totpBackupCodes: user.totpBackupCodes.filter(c => c !== hashed) },
      })
      return true
    }
  }
  return false
}

export async function disableTotp(code: string): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }
  if (!session.user.totpEnabled) return { success: false, error: 'not_enabled' }
  if (session.user.requiresMfa) return { success: false, error: 'mfa_required' }

  const ok = await verifyCurrentTotp(session.user.id, code)
  if (!ok) return { success: false, error: 'invalid_code' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null, totpEnabled: false, totpBackupCodes: [] },
  })

  return { success: true }
}

export async function setEmailPreferences(prefs: EmailPreferences): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }

  const sanitized: EmailPreferences = {}
  for (const key of EMAIL_PREFERENCE_KEYS) {
    if (typeof prefs[key] === 'boolean') sanitized[key] = prefs[key]
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailPreferences: sanitized },
  })
  return { success: true }
}

export async function deleteAccount(password: string): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })
  if (!user) return { success: false, error: 'unauthorized' }

  const valid = await bcrypt.compare(password ?? '', user.passwordHash)
  if (!valid) return { success: false, error: 'current_password_wrong' }

  // Cascades delete all related records (Players, Leagues, GameTemplates,
  // Notifications, Tickets, ConnectionRequests, VaultConnections, etc.) via
  // onDelete: Cascade in the Prisma schema.
  await prisma.user.delete({ where: { id: session.user.id } })

  const locale = (session.user.locale ?? 'en') as Locale
  await signOut({ redirectTo: `/${locale}` })

  return { success: true }
}

export async function regenerateBackupCodes(
  code: string
): Promise<Result<{ backupCodes: string[] }>> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }
  if (!session.user.totpEnabled) return { success: false, error: 'not_enabled' }

  const ok = await verifyCurrentTotp(session.user.id, code)
  if (!ok) return { success: false, error: 'invalid_code' }

  const backupCodes = generateBackupCodes()
  const hashed = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 8)))
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpBackupCodes: hashed },
  })

  return { success: true, backupCodes }
}

const usernameSchema = /^[a-z0-9_]{3,32}$/

export async function updateUsername(formData: FormData): Promise<Result> {
  const session = await auth()
  if (!session) return { success: false, error: 'unauthorized' }

  const raw = formData.get('username')
  const username = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!usernameSchema.test(username)) {
    return { success: false, error: 'username_invalid' }
  }

  const existing = await prisma.user.findFirst({
    where: { username, id: { not: session.user.id } },
    select: { id: true },
  })
  if (existing) return { success: false, error: 'username_taken' }

  await prisma.user.update({ where: { id: session.user.id }, data: { username } })
  revalidatePath('/app/settings')
  revalidatePath('/app/profile')
  return { success: true }
}

const VALID_PROFILE_MODES = new Set(['private', 'stats', 'full'])

export async function updatePrivacySettings(input: {
  publicProfileMode: 'private' | 'stats' | 'full'
  allowAppearInOthers: boolean
}) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')
  if (!VALID_PROFILE_MODES.has(input.publicProfileMode)) {
    throw new Error('Invalid publicProfileMode')
  }
  await prisma.user.update({
    where: { id: session!.user.id },
    data: {
      publicProfileMode: input.publicProfileMode,
      allowAppearInOthers: input.allowAppearInOthers,
    },
  })
  revalidatePath('/app/settings')
  revalidatePath('/app/profile')
}
