import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/heroMedia', () => ({ getHeroMedia: vi.fn() }))
vi.mock('@/lib/uploads', () => ({ openUploadStream: vi.fn() }))

import { getHeroMedia } from '@/lib/heroMedia'
import { openUploadStream } from '@/lib/uploads'
import { GET } from '@/app/api/landing/hero-media/route'

const descriptor = {
  kind: 'video' as const,
  storageKey: 'landing/v.mp4',
  mimeType: 'video/mp4',
  uploadedAt: '2026-05-20T00:00:00.000Z',
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/landing/hero-media', () => {
  it('returns 404 when no hero media is configured', async () => {
    vi.mocked(getHeroMedia).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns 404 when the file is missing on disk', async () => {
    vi.mocked(getHeroMedia).mockResolvedValue(descriptor)
    vi.mocked(openUploadStream).mockRejectedValue(new Error('ENOENT'))
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('streams the file with the stored content type', async () => {
    vi.mocked(getHeroMedia).mockResolvedValue(descriptor)
    vi.mocked(openUploadStream).mockResolvedValue({ stream: new ReadableStream(), size: 1234 })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('video/mp4')
    expect(res.headers.get('Content-Length')).toBe('1234')
  })
})
