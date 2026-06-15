import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/umami', () => ({ getActiveVisitors: vi.fn() }))

import { auth } from '@/lib/auth'
import { getActiveVisitors } from '@/lib/umami'
import { GET } from './route'

describe('GET /api/admin/analytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: 'user' } } as never)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns the active count for an admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { role: 'admin' } } as never)
    vi.mocked(getActiveVisitors).mockResolvedValue(5)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ active: 5 })
  })
})
