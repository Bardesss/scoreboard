import { describe, it, expect } from 'vitest'

describe('prisma singleton', () => {
  it('exports a prisma client instance', async () => {
    const { prisma } = await import('@/lib/prisma')
    expect(prisma).toBeDefined()
    expect(typeof prisma.$queryRaw).toBe('function')
  })

  it('$queryRaw resolves without throwing', async () => {
    const { prisma } = await import('@/lib/prisma')
    await expect(prisma.$queryRaw`SELECT 1`).resolves.not.toThrow()
  })
})
