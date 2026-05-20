import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { adminSettings: { findUnique: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { detectHeroMediaKind, getHeroMedia } from './heroMedia'

function bytes(...values: number[]): Buffer {
  const buf = Buffer.alloc(16)
  values.forEach((v, i) => { buf[i] = v })
  return buf
}

describe('detectHeroMediaKind', () => {
  it('detects JPEG', () => {
    expect(detectHeroMediaKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({
      kind: 'image', mimeType: 'image/jpeg', ext: 'jpg',
    })
  })

  it('detects PNG', () => {
    expect(detectHeroMediaKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({
      kind: 'image', mimeType: 'image/png', ext: 'png',
    })
  })

  it('detects WebP', () => {
    const buf = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'ascii')
    expect(detectHeroMediaKind(buf)).toEqual({
      kind: 'image', mimeType: 'image/webp', ext: 'webp',
    })
  })

  it('detects MP4 by the ftyp box', () => {
    const buf = Buffer.from('\0\0\0\x18ftypisom', 'ascii')
    expect(detectHeroMediaKind(buf)).toEqual({
      kind: 'video', mimeType: 'video/mp4', ext: 'mp4',
    })
  })

  it('detects WebM by the EBML header', () => {
    expect(detectHeroMediaKind(bytes(0x1a, 0x45, 0xdf, 0xa3))).toEqual({
      kind: 'video', mimeType: 'video/webm', ext: 'webm',
    })
  })

  it('returns null for an unrecognised file', () => {
    expect(detectHeroMediaKind(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull()
  })

  it('returns null for a too-short buffer', () => {
    expect(detectHeroMediaKind(Buffer.from([0xff, 0xd8]))).toBeNull()
  })
})

describe('getHeroMedia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when the setting is absent', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue(null)
    expect(await getHeroMedia()).toBeNull()
  })

  it('returns the descriptor when the setting is valid', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({
      key: 'landing.heroMedia',
      value: { kind: 'video', storageKey: 'landing/x.mp4', mimeType: 'video/mp4', uploadedAt: '2026-05-20T00:00:00.000Z' },
    } as never)
    expect(await getHeroMedia()).toEqual({
      kind: 'video', storageKey: 'landing/x.mp4', mimeType: 'video/mp4', uploadedAt: '2026-05-20T00:00:00.000Z',
    })
  })

  it('returns null when the stored value is malformed', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({
      key: 'landing.heroMedia',
      value: { kind: 'pdf', storageKey: 123 },
    } as never)
    expect(await getHeroMedia()).toBeNull()
  })
})
