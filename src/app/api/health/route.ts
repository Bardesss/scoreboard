import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'ok'
  let redisStatus: 'ok' | 'error' = 'ok'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  try {
    const pong = await redis.ping()
    if (pong !== 'PONG') redisStatus = 'error'
  } catch {
    redisStatus = 'error'
  }

  const healthy = dbStatus === 'ok' && redisStatus === 'ok'

  return NextResponse.json(
    { db: dbStatus, redis: redisStatus },
    { status: healthy ? 200 : 503 }
  )
}
