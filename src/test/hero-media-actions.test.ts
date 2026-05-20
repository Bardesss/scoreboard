import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminSettings: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/uploads', () => ({
  saveLandingMedia: vi.fn(),
  deleteUploadFile: vi.fn(),
  LANDING_IMAGE_MAX_BYTES: 8 * 1024 * 1024,
  LANDING_VIDEO_MAX_BYTES: 25 * 1024 * 1024,
}))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { saveLandingMedia, deleteUploadFile } from '@/lib/uploads'
import { uploadHeroMedia, removeHeroMedia } from '@/app/admin/landing/hero/actions'

const admin = { user: { id: 'a1', email: 'a@x.com', locale: 'en', role: 'admin' } }

function jpegFile(sizeBytes = 12): File {
  const buf = new Uint8Array(sizeBytes)
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff; buf[3] = 0xe0
  return new File([buf], 'hero.jpg', { type: 'image/jpeg' })
}

function formWith(file?: File): FormData {
  const fd = new FormData()
  if (file) fd.set('file', file)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(admin as never)
  vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue(null)
  vi.mocked(saveLandingMedia).mockResolvedValue('landing/new.jpg')
})

describe('uploadHeroMedia', () => {
  it('rejects a non-admin caller', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { ...admin.user, role: 'user' } } as never)
    expect(await uploadHeroMedia(formWith(jpegFile()))).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('rejects a request with no file', async () => {
    expect(await uploadHeroMedia(formWith())).toEqual({ ok: false, error: 'no_file' })
  })

  it('rejects an unrecognised file type', async () => {
    const file = new File([new Uint8Array(12)], 'x.bin', { type: 'application/octet-stream' })
    expect(await uploadHeroMedia(formWith(file))).toEqual({ ok: false, error: 'invalid_type' })
  })

  it('rejects an image over the 8 MB image limit', async () => {
    const result = await uploadHeroMedia(formWith(jpegFile(8 * 1024 * 1024 + 1)))
    expect(result).toEqual({ ok: false, error: 'too_large' })
  })

  it('saves the file and upserts the setting on success', async () => {
    const result = await uploadHeroMedia(formWith(jpegFile()))
    expect(result).toEqual({ ok: true })
    expect(saveLandingMedia).toHaveBeenCalledOnce()
    expect(prisma.adminSettings.upsert).toHaveBeenCalledOnce()
    const upsertArg = vi.mocked(prisma.adminSettings.upsert).mock.calls[0][0]
    expect(upsertArg.where).toEqual({ key: 'landing.heroMedia' })
  })

  it('deletes the previous file when replacing existing media', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({
      key: 'landing.heroMedia',
      value: { kind: 'image', storageKey: 'landing/old.png', mimeType: 'image/png', uploadedAt: '2026-01-01T00:00:00.000Z' },
    } as never)
    await uploadHeroMedia(formWith(jpegFile()))
    expect(deleteUploadFile).toHaveBeenCalledWith('landing/old.png')
  })

  it('returns ok:false with error unknown when saveLandingMedia throws', async () => {
    vi.mocked(saveLandingMedia).mockRejectedValue(new Error('disk full'))
    expect(await uploadHeroMedia(formWith(jpegFile()))).toEqual({ ok: false, error: 'unknown' })
  })
})

describe('removeHeroMedia', () => {
  it('rejects a non-admin caller', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    expect(await removeHeroMedia()).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('deletes the file and the setting row when media exists', async () => {
    vi.mocked(prisma.adminSettings.findUnique).mockResolvedValue({
      key: 'landing.heroMedia',
      value: { kind: 'video', storageKey: 'landing/v.mp4', mimeType: 'video/mp4', uploadedAt: '2026-01-01T00:00:00.000Z' },
    } as never)
    expect(await removeHeroMedia()).toEqual({ ok: true })
    expect(deleteUploadFile).toHaveBeenCalledWith('landing/v.mp4')
    expect(prisma.adminSettings.delete).toHaveBeenCalledWith({ where: { key: 'landing.heroMedia' } })
  })

  it('is a no-op (but still ok) when no media is set', async () => {
    expect(await removeHeroMedia()).toEqual({ ok: true })
    expect(deleteUploadFile).not.toHaveBeenCalled()
    expect(prisma.adminSettings.delete).not.toHaveBeenCalled()
  })
})
