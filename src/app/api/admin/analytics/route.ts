import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getActiveVisitors } from '@/lib/umami'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const active = await getActiveVisitors()
  return NextResponse.json({ active }, { headers: { 'Cache-Control': 'no-store' } })
}
