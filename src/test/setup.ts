import { vi, afterEach } from 'vitest'

// Global mock for Prisma — overridden per test as needed
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
  },
}))

// Global mock for Redis — overridden per test as needed
vi.mock('@/lib/redis', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})
