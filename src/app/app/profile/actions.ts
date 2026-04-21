'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const usernameSchema = z.string().min(3).max(32).regex(/^[a-z0-9_]+$/)

export async function updateUsername(formData: FormData) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const username = (formData.get('username') as string)?.trim().toLowerCase()
  if (!usernameSchema.safeParse(username).success) {
    return { error: 'Invalid username. Use lowercase letters, numbers, underscores. Min 3 chars.' }
  }

  const existing = await prisma.user.findFirst({ where: { username, id: { not: session.user.id } } })
  if (existing) return { error: 'Username already taken.' }

  await prisma.user.update({ where: { id: session.user.id }, data: { username } })
  return { success: true }
}
