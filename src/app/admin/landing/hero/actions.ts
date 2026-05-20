'use server'

import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  saveLandingMedia,
  deleteUploadFile,
  LANDING_IMAGE_MAX_BYTES,
  LANDING_VIDEO_MAX_BYTES,
} from '@/lib/uploads'
import { detectHeroMediaKind, getHeroMedia, HERO_MEDIA_SETTINGS_KEY } from '@/lib/heroMedia'

export type HeroMediaResult = { ok: true } | { ok: false; error: string }

async function isAdmin(): Promise<boolean> {
  const session = await auth()
  return !!session && session.user.role === 'admin'
}

export async function uploadHeroMedia(formData: FormData): Promise<HeroMediaResult> {
  if (!(await isAdmin())) return { ok: false, error: 'unauthorized' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'no_file' }
  // First-pass guard against the largest allowed size before reading into memory.
  if (file.size > LANDING_VIDEO_MAX_BYTES) return { ok: false, error: 'too_large' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = detectHeroMediaKind(buffer)
  if (!detected) return { ok: false, error: 'invalid_type' }

  const limit = detected.kind === 'image' ? LANDING_IMAGE_MAX_BYTES : LANDING_VIDEO_MAX_BYTES
  if (buffer.length > limit) return { ok: false, error: 'too_large' }

  try {
    const previous = await getHeroMedia()
    const storageKey = await saveLandingMedia(randomUUID(), detected.ext, buffer)

    const value = {
      kind: detected.kind,
      storageKey,
      mimeType: detected.mimeType,
      uploadedAt: new Date().toISOString(),
    }
    await prisma.adminSettings.upsert({
      where: { key: HERO_MEDIA_SETTINGS_KEY },
      update: { value: value as Prisma.InputJsonValue },
      create: { key: HERO_MEDIA_SETTINGS_KEY, value: value as Prisma.InputJsonValue },
    })

    if (previous && previous.storageKey !== storageKey) {
      await deleteUploadFile(previous.storageKey)
    }

    revalidatePath('/admin/landing/hero')
    return { ok: true }
  } catch (e) {
    console.error('[heroMedia] uploadHeroMedia failed', e)
    return { ok: false, error: 'unknown' }
  }
}

export async function removeHeroMedia(): Promise<HeroMediaResult> {
  if (!(await isAdmin())) return { ok: false, error: 'unauthorized' }

  try {
    const current = await getHeroMedia()
    if (current) {
      await deleteUploadFile(current.storageKey)
      await prisma.adminSettings.delete({ where: { key: HERO_MEDIA_SETTINGS_KEY } })
    }

    revalidatePath('/admin/landing/hero')
    return { ok: true }
  } catch (e) {
    console.error('[heroMedia] removeHeroMedia failed', e)
    return { ok: false, error: 'unknown' }
  }
}
