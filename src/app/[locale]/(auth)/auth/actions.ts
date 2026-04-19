'use server'

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { signIn } from '@/lib/auth'
import { sendVerificationEmail, sendPasswordResetEmail, isMailConfigured } from '@/lib/mail'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { redirect } from 'next/navigation'
import { z } from 'zod'

type ActionResult = { error: string } | { success: true } | void

const emailSchema = z.string().email()
const passwordSchema = z.string().min(8)

export async function register(formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string
  const locale = (formData.get('locale') as string) || 'en'

  if (!emailSchema.safeParse(email).success) return { error: 'auth.errors.invalidEmail' }
  if (!passwordSchema.safeParse(password).success) return { error: 'auth.errors.passwordTooShort' }
  if (password !== passwordConfirm) return { error: 'auth.errors.passwordMismatch' }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'auth.errors.emailInUse' }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      locale,
      emailVerified: isMailConfigured() ? null : new Date(),
    },
  })

  if (isMailConfigured()) {
    const token = crypto.randomUUID()
    await redis.setex(`email_verify:${token}`, 60 * 60 * 24, user.id)
    await sendVerificationEmail(email, token, locale)
  }

  return { success: true }
}

export async function verifyEmail(token: string): Promise<ActionResult> {
  const userId = await redis.get(`email_verify:${token}`)
  if (!userId) return { error: 'auth.verify.invalid' }

  await prisma.user.update({
    where: { id: userId as string },
    data: { emailVerified: new Date() },
  })
  await redis.del(`email_verify:${token}`)

  return { success: true }
}

export async function login(formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const locale = (formData.get('locale') as string) || 'en'

  if (!emailSchema.safeParse(email).success || !password) {
    return { error: 'auth.errors.invalidCredentials' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.emailVerified) {
    if (user && !user.emailVerified) return { error: 'auth.errors.emailNotVerified' }
    return { error: 'auth.errors.invalidCredentials' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'auth.errors.invalidCredentials' }

  if (user.totpEnabled) {
    const pendingToken = crypto.randomUUID()
    await redis.setex(`totp_pending:${pendingToken}`, 300, user.id)
    redirect(`/${locale}/auth/totp-challenge?token=${pendingToken}`)
  }

  await signIn('credentials', { email, password, redirectTo: '/app/dashboard' })
}

export async function verifyTotp(formData: FormData): Promise<ActionResult> {
  const pendingToken = formData.get('token') as string
  const code = (formData.get('code') as string)?.trim()
  const locale = (formData.get('locale') as string) || 'en'

  const userId = await redis.get(`totp_pending:${pendingToken}`)
  if (!userId) return { error: 'auth.totp.expired' }

  const user = await prisma.user.findUnique({ where: { id: userId as string } })
  if (!user || !user.totpSecret) return { error: 'auth.errors.serverError' }

  const { verifyTOTPCode } = await import('@/lib/totp')
  let valid = verifyTOTPCode(user.totpSecret, code)

  if (!valid && user.totpBackupCodes.length > 0) {
    for (const hashed of user.totpBackupCodes) {
      const match = await bcrypt.compare(code, hashed)
      if (match) {
        valid = true
        await prisma.user.update({
          where: { id: user.id },
          data: { totpBackupCodes: user.totpBackupCodes.filter(c => c !== hashed) },
        })
        break
      }
    }
  }

  if (!valid) return { error: 'auth.totp.invalid' }

  await redis.del(`totp_pending:${pendingToken}`)

  const verifiedToken = crypto.randomUUID()
  await redis.setex(`totp_verified:${verifiedToken}`, 30, user.id)

  await signIn('credentials', { totpVerifiedToken: verifiedToken, redirectTo: '/app/dashboard' })
}

export async function forgotPassword(formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const locale = (formData.get('locale') as string) || 'en'

  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    const token = crypto.randomUUID()
    await redis.setex(`pw_reset:${token}`, 60 * 15, user.id)
    await sendPasswordResetEmail(email, token, locale)
  }

  return { success: true }
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const token = formData.get('token') as string
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string

  if (!passwordSchema.safeParse(password).success) return { error: 'auth.errors.passwordTooShort' }
  if (password !== passwordConfirm) return { error: 'auth.errors.passwordMismatch' }

  const userId = await redis.get(`pw_reset:${token}`)
  if (!userId) return { error: 'auth.reset.invalid' }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: userId as string },
    data: { passwordHash },
  })
  await redis.del(`pw_reset:${token}`)

  return { success: true }
}
