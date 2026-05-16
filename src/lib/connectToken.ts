import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

function generate(): string {
  return crypto.randomBytes(16).toString('base64url')
}

export async function ensureConnectToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { connectToken: true },
  })
  if (user?.connectToken) return user.connectToken

  // Loop on the (astronomically unlikely) unique collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generate()
    try {
      await prisma.user.update({ where: { id: userId }, data: { connectToken: token } })
      return token
    } catch {
      // unique violation — try a fresh token
    }
  }
  throw new Error('failed to generate connect token')
}

export async function rotateConnectToken(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generate()
    try {
      await prisma.user.update({ where: { id: userId }, data: { connectToken: token } })
      return token
    } catch {
      // unique violation — try a fresh token
    }
  }
  throw new Error('failed to rotate connect token')
}

export function buildConnectUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? ''
  return `${base}/app/connect/${token}`
}
