import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const raw = (searchParams.get('name') ?? '').trim().toLowerCase()

  if (!raw) return NextResponse.json({ available: false, error: 'empty' })
  if (!USERNAME_RE.test(raw)) return NextResponse.json({ available: false, error: 'invalid' })

  const existing = await prisma.user.findUnique({ where: { username: raw }, select: { id: true } })
  return NextResponse.json({ available: existing === null })
}
