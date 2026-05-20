import { prisma } from '@/lib/prisma'

export const HERO_MEDIA_SETTINGS_KEY = 'landing.heroMedia'

export type HeroMediaDescriptor = {
  kind: 'image' | 'video'
  storageKey: string
  mimeType: string
  uploadedAt: string
}

export type DetectedHeroMedia = {
  kind: 'image' | 'video'
  mimeType: string
  ext: string
}

/**
 * Identify hero media by inspecting magic bytes — never trust a client-supplied
 * MIME type. Returns null for anything that is not an allowed image or video.
 */
export function detectHeroMediaKind(buf: Buffer): DetectedHeroMedia | null {
  if (buf.length < 12) return null

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { kind: 'image', mimeType: 'image/jpeg', ext: 'jpg' }
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { kind: 'image', mimeType: 'image/png', ext: 'png' }
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { kind: 'image', mimeType: 'image/webp', ext: 'webp' }
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { kind: 'video', mimeType: 'video/webm', ext: 'webm' }
  }
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    return { kind: 'video', mimeType: 'video/mp4', ext: 'mp4' }
  }
  return null
}

/** Read the current hero media descriptor, or null when none is configured. */
export async function getHeroMedia(): Promise<HeroMediaDescriptor | null> {
  const row = await prisma.adminSettings.findUnique({ where: { key: HERO_MEDIA_SETTINGS_KEY } })
  if (!row || row.value === null || typeof row.value !== 'object') return null

  const v = row.value as Record<string, unknown>
  const { kind, storageKey, mimeType, uploadedAt } = v
  if (
    (kind !== 'image' && kind !== 'video') ||
    typeof storageKey !== 'string' ||
    typeof mimeType !== 'string' ||
    typeof uploadedAt !== 'string'
  ) {
    return null
  }
  return { kind, storageKey, mimeType, uploadedAt }
}
