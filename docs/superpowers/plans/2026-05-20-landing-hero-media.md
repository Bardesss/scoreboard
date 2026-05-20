# Landing Hero Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin upload a custom hero image or short looping video for the landing page, replacing the hardcoded `public/hero-game-night.jpg`.

**Architecture:** The uploaded file is stored on the existing `dicevault-uploads` persistent volume (under a `landing/` subfolder); a small JSON descriptor is saved in the `AdminSettings` key-value table. A public API route streams the file to landing-page visitors. The marketing page reads the descriptor and renders an `<img>`, an auto-playing muted looping `<video>`, or falls back to the bundled photo.

**Tech Stack:** Next.js 15 (App Router, Route Handlers, Server Actions), React 19, Prisma, Vitest. Filesystem uploads via `src/lib/uploads.ts`.

**Spec:** `docs/superpowers/specs/2026-05-20-landing-hero-media-design.md`

---

## File Structure

**Create:**
- `src/lib/heroMedia.ts` — descriptor type, settings key, magic-byte detection, `getHeroMedia()` reader
- `src/lib/heroMedia.test.ts` — unit tests for detection + reader
- `src/lib/uploads.test.ts` — unit tests for the new landing upload helpers
- `src/app/admin/landing/hero/actions.ts` — `uploadHeroMedia` / `removeHeroMedia` server actions
- `src/app/admin/landing/hero/page.tsx` — admin page (server component)
- `src/app/admin/landing/hero/HeroMediaClient.tsx` — admin upload UI (client component)
- `src/app/api/landing/hero-media/route.ts` — public streaming GET route
- `src/app/[locale]/(marketing)/_components/HeroMedia.tsx` — landing-page hero renderer
- `src/test/hero-media-actions.test.ts` — server-action tests
- `src/test/hero-media-route.test.ts` — API route tests

**Modify:**
- `src/lib/uploads.ts` — add landing constants + `saveLandingMedia`, `deleteUploadFile`, `openUploadStream`
- `src/app/admin/landing/page.tsx` — add a card linking to `/admin/landing/hero`
- `src/app/[locale]/(marketing)/page.tsx` — render `HeroMedia`, drop the unused `Image` import
- `README.md` — broaden the persistent-volume description

No Prisma migration is needed — `AdminSettings` already exists.

---

## Task 1: Landing upload helpers in `uploads.ts`

**Files:**
- Modify: `src/lib/uploads.ts`
- Test: `src/lib/uploads.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/uploads.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { saveLandingMedia, deleteUploadFile, openUploadStream } from './uploads'

let tmpDir: string
let originalUploadsDir: string | undefined

beforeAll(async () => {
  originalUploadsDir = process.env.UPLOADS_DIR
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-test-'))
  process.env.UPLOADS_DIR = tmpDir
})

afterAll(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR
  else process.env.UPLOADS_DIR = originalUploadsDir
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('saveLandingMedia', () => {
  it('writes the file under landing/ and returns the storage key', async () => {
    const key = await saveLandingMedia('abc', 'jpg', Buffer.from('hello'))
    expect(key).toBe('landing/abc.jpg')
    const written = await fs.readFile(path.join(tmpDir, 'landing', 'abc.jpg'))
    expect(written.toString()).toBe('hello')
  })
})

describe('openUploadStream', () => {
  it('returns the byte size and a readable stream of the file', async () => {
    const data = Buffer.from('streamed-content')
    const key = await saveLandingMedia('stream', 'mp4', data)
    const { stream, size } = await openUploadStream(key)
    expect(size).toBe(data.length)
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    expect(Buffer.concat(chunks).toString()).toBe('streamed-content')
  })
})

describe('deleteUploadFile', () => {
  it('removes the file and is safe to call when it is already gone', async () => {
    const key = await saveLandingMedia('del', 'png', Buffer.from('x'))
    await deleteUploadFile(key)
    await expect(fs.access(path.join(tmpDir, 'landing', 'del.png'))).rejects.toThrow()
    await expect(deleteUploadFile(key)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/uploads.test.ts`
Expected: FAIL — `saveLandingMedia`, `deleteUploadFile`, `openUploadStream` are not exported.

- [ ] **Step 3: Implement the helpers**

In `src/lib/uploads.ts`, change the top `fs` import to also pull in `createReadStream`, and add a `stream` import:

```ts
import { promises as fs, createReadStream } from 'fs'
import path from 'path'
import { Readable } from 'stream'
```

Then add, after the existing `ATTACHMENT_*` constants:

```ts
export const LANDING_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const LANDING_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const
export const LANDING_IMAGE_MAX_BYTES = 8 * 1024 * 1024
export const LANDING_VIDEO_MAX_BYTES = 25 * 1024 * 1024
```

And add these functions at the end of the file:

```ts
export async function saveLandingMedia(
  id: string,
  ext: string,
  data: Buffer | Uint8Array
): Promise<string> {
  const storageKey = path.posix.join('landing', `${id}.${ext}`)
  const full = resolveStoragePath(storageKey)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, data)
  return storageKey
}

export async function deleteUploadFile(storageKey: string): Promise<void> {
  const full = resolveStoragePath(storageKey)
  try {
    await fs.unlink(full)
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') {
      console.error('[uploads] unlink failed', storageKey, err.message)
    }
  }
}

export async function openUploadStream(
  storageKey: string
): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
  const full = resolveStoragePath(storageKey)
  const stat = await fs.stat(full)
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>
  return { stream, size: stat.size }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/uploads.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/uploads.ts src/lib/uploads.test.ts
git commit -m "feat(uploads): add landing media save/delete/stream helpers"
```

---

## Task 2: `heroMedia` module — type, detection, reader

**Files:**
- Create: `src/lib/heroMedia.ts`
- Test: `src/lib/heroMedia.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heroMedia.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/heroMedia.test.ts`
Expected: FAIL — module `./heroMedia` does not exist.

- [ ] **Step 3: Implement `src/lib/heroMedia.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/heroMedia.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heroMedia.ts src/lib/heroMedia.test.ts
git commit -m "feat(landing): add hero media descriptor type, detection and reader"
```

---

## Task 3: Server actions — upload & remove

**Files:**
- Create: `src/app/admin/landing/hero/actions.ts`
- Test: `src/test/hero-media-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/hero-media-actions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/hero-media-actions.test.ts`
Expected: FAIL — module `@/app/admin/landing/hero/actions` does not exist.

- [ ] **Step 3: Implement `src/app/admin/landing/hero/actions.ts`**

```ts
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
}

export async function removeHeroMedia(): Promise<HeroMediaResult> {
  if (!(await isAdmin())) return { ok: false, error: 'unauthorized' }

  const current = await getHeroMedia()
  if (current) {
    await deleteUploadFile(current.storageKey)
    await prisma.adminSettings.delete({ where: { key: HERO_MEDIA_SETTINGS_KEY } })
  }

  revalidatePath('/admin/landing/hero')
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/hero-media-actions.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/landing/hero/actions.ts src/test/hero-media-actions.test.ts
git commit -m "feat(landing): add hero media upload and remove server actions"
```

---

## Task 4: Public streaming API route

**Files:**
- Create: `src/app/api/landing/hero-media/route.ts`
- Test: `src/test/hero-media-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/hero-media-route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/hero-media-route.test.ts`
Expected: FAIL — module `@/app/api/landing/hero-media/route` does not exist.

- [ ] **Step 3: Implement `src/app/api/landing/hero-media/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getHeroMedia } from '@/lib/heroMedia'
import { openUploadStream } from '@/lib/uploads'

// Public landing-page asset — no auth. The page appends ?v=<uploadedAt> so
// browsers refetch when the admin changes the media.
export async function GET(): Promise<NextResponse> {
  const media = await getHeroMedia()
  if (!media) return new NextResponse('Not found', { status: 404 })

  let opened: { stream: ReadableStream<Uint8Array>; size: number }
  try {
    opened = await openUploadStream(media.storageKey)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }

  return new NextResponse(opened.stream, {
    status: 200,
    headers: {
      'Content-Type': media.mimeType,
      'Content-Length': String(opened.size),
      'Cache-Control': 'public, max-age=300',
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/hero-media-route.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/landing/hero-media/route.ts src/test/hero-media-route.test.ts
git commit -m "feat(landing): add public streaming route for hero media"
```

---

## Task 5: Render the hero media on the landing page

The marketing page is a server component; no component render tests exist in this codebase (Vitest runs in the `node` environment), so this task is verified by type-check and the build.

**Files:**
- Create: `src/app/[locale]/(marketing)/_components/HeroMedia.tsx`
- Modify: `src/app/[locale]/(marketing)/page.tsx`

- [ ] **Step 1: Create the `HeroMedia` component**

Create `src/app/[locale]/(marketing)/_components/HeroMedia.tsx`:

```tsx
import Image from 'next/image'
import type { HeroMediaDescriptor } from '@/lib/heroMedia'

const ALT = 'Friends rolling dice at game night'

/**
 * Renders the landing-page hero visual: an admin-uploaded image or auto-playing
 * looping video, or the bundled fallback photo when nothing is configured.
 * Drops into the existing framed/glow box in the marketing page.
 */
export function HeroMedia({ media }: { media: HeroMediaDescriptor | null }) {
  if (!media) {
    return (
      <Image
        src="/hero-game-night.jpg"
        alt={ALT}
        width={420}
        height={300}
        className="block w-full h-auto"
        style={{ objectFit: 'cover', display: 'block' }}
        priority
      />
    )
  }

  const src = `/api/landing/hero-media?v=${encodeURIComponent(media.uploadedAt)}`
  const mediaStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    aspectRatio: '420 / 300',
    objectFit: 'cover',
  }

  if (media.kind === 'video') {
    return <video src={src} autoPlay muted loop playsInline style={mediaStyle} />
  }

  // eslint-disable-next-line @next/next/no-img-element -- dynamic upload route, next/image optimisation not wanted here
  return <img src={src} alt={ALT} style={mediaStyle} />
}
```

- [ ] **Step 2: Wire it into the marketing page**

In `src/app/[locale]/(marketing)/page.tsx`:

Remove the now-unused next/image import (line 3) — `import Image from 'next/image'`. Add the two new imports near the existing `FreeModeRibbon` import (line 8):

```ts
import { HeroMedia } from './_components/HeroMedia'
import { getHeroMedia } from '@/lib/heroMedia'
```

After the existing `const freeMode = await loadFreeModeState()` line (line 85), add:

```ts
  const heroMedia = await getHeroMedia()
```

Replace the hero `<Image>` block (lines 207-215, inside `{/* Right: photo */}` → the framed `<div>`):

```tsx
              <Image
                src="/hero-game-night.jpg"
                alt="Friends rolling dice at game night"
                width={420}
                height={300}
                className="block w-full h-auto"
                style={{ objectFit: 'cover', display: 'block' }}
                priority
              />
```

with:

```tsx
              <HeroMedia media={heroMedia} />
```

Leave the surrounding glow ring, rounded wrapper, bottom vignette, and floating `DieFace` dice exactly as they are.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `tsc` reports `Image` is declared but never used, confirm the import on line 3 was removed.)

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open the landing page logged out. With no hero media configured, the bundled `hero-game-night.jpg` still shows in the framed box.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/(marketing)/_components/HeroMedia.tsx" "src/app/[locale]/(marketing)/page.tsx"
git commit -m "feat(landing): render admin-configured hero media with photo fallback"
```

---

## Task 6: Admin UI — upload page

**Files:**
- Create: `src/app/admin/landing/hero/HeroMediaClient.tsx`
- Create: `src/app/admin/landing/hero/page.tsx`
- Modify: `src/app/admin/landing/page.tsx`

- [ ] **Step 1: Create the client component**

Create `src/app/admin/landing/hero/HeroMediaClient.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { HeroMediaDescriptor } from '@/lib/heroMedia'
import { uploadHeroMedia, removeHeroMedia } from './actions'

const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Je hebt geen rechten voor deze actie.',
  no_file: 'Kies eerst een bestand.',
  too_large: 'Bestand is te groot (afbeelding max 8 MB, video max 25 MB).',
  invalid_type: 'Niet-ondersteund bestandstype. Gebruik JPG, PNG, WebP, MP4 of WebM.',
  unknown: 'Er ging iets mis. Probeer het opnieuw.',
}

const buttonStyle: React.CSSProperties = {
  background: '#005bc0',
  color: '#fff',
  borderRadius: 10,
  padding: '9px 18px',
  fontSize: 13.5,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
}

export function HeroMediaClient({ media }: { media: HeroMediaDescriptor | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function showError(code: string) {
    setError(ERROR_TEXT[code] ?? ERROR_TEXT.unknown)
  }

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const result = await uploadHeroMedia(fd)
      if (result.ok) {
        form.reset()
        router.refresh()
      } else {
        showError(result.error)
      }
    })
  }

  function onRemove() {
    setError(null)
    startTransition(async () => {
      const result = await removeHeroMedia()
      if (result.ok) router.refresh()
      else showError(result.error)
    })
  }

  const previewSrc = media ? `/api/landing/hero-media?v=${encodeURIComponent(media.uploadedAt)}` : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current state */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
          Huidige hero
        </div>
        <div
          style={{
            width: 280,
            aspectRatio: '420 / 300',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          {media && previewSrc ? (
            media.kind === 'video' ? (
              <video
                src={previewSrc}
                autoPlay
                muted
                loop
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic upload route
              <img
                src={previewSrc}
                alt="Hero preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- bundled fallback asset
            <img
              src="/hero-game-night.jpg"
              alt="Standaard hero"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
          {media
            ? `Aangepaste ${media.kind === 'video' ? 'video' : 'afbeelding'} actief.`
            : 'Standaardafbeelding wordt gebruikt.'}
        </p>
      </div>

      {/* Upload form */}
      <form onSubmit={onUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          required
          disabled={pending}
          style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}
        />
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          JPG, PNG of WebP (max 8 MB), of MP4 / WebM video (max 25 MB). Video&apos;s spelen
          automatisch af zonder geluid en herhalen.
        </p>
        <button type="submit" disabled={pending} style={{ ...buttonStyle, opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Bezig…' : 'Uploaden'}
        </button>
      </form>

      {/* Remove */}
      {media && (
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          style={{
            ...buttonStyle,
            background: 'transparent',
            color: '#ff6b6b',
            border: '1px solid rgba(255,107,107,0.4)',
            alignSelf: 'flex-start',
            opacity: pending ? 0.6 : 1,
          }}
        >
          Verwijderen / terug naar standaard
        </button>
      )}

      {error && (
        <div
          style={{
            fontSize: 13,
            color: '#ff6b6b',
            background: 'rgba(255,107,107,0.1)',
            border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the admin page**

Create `src/app/admin/landing/hero/page.tsx`:

```tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getHeroMedia } from '@/lib/heroMedia'
import { HeroMediaClient } from './HeroMediaClient'

export default async function AdminLandingHeroPage() {
  const media = await getHeroMedia()

  return (
    <div>
      <Link
        href="/admin/landing"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={15} /> Terug naar Landing instellingen
      </Link>

      <h1
        className="font-headline"
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.87)',
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}
      >
        Hero afbeelding / video
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
        Upload een eigen afbeelding of korte video voor de hero op de landingspagina.
      </p>

      <div
        style={{
          background: '#161f28',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <HeroMediaClient media={media} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add a card on the Landing settings page**

In `src/app/admin/landing/page.tsx`, add the `Image` icon to the existing lucide import (line 2):

```ts
import { MessageSquareQuote, FileText, Image } from 'lucide-react'
```

Insert this card between the Reviews card and the Content card (after the closing `</div>` of the Reviews card, before `{/* Content card */}`):

```tsx
        {/* Hero media card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'rgba(245,166,35,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Image size={20} style={{ color: '#f5a623' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4 }}>
                  Hero afbeelding / video
                </div>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                  Upload een eigen afbeelding of korte video voor de hero op de landingspagina.
                </p>
              </div>
            </div>
            <Link
              href="/admin/landing/hero"
              style={{
                flexShrink: 0,
                background: '#005bc0',
                color: '#fff',
                borderRadius: 10,
                padding: '8px 18px',
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Beheren
            </Link>
          </div>
        </div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, sign in as an admin, go to `/admin/landing` → "Beheren" on the new card. Upload a JPG: it appears in the preview and on the landing page. Upload an MP4: it auto-plays muted and loops. Click "Verwijderen": the hero reverts to the bundled photo. Try a `.txt` file: the `invalid_type` error shows.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/landing/hero/page.tsx src/app/admin/landing/hero/HeroMediaClient.tsx src/app/admin/landing/page.tsx
git commit -m "feat(admin): hero media upload page under Landing settings"
```

---

## Task 7: Update the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Broaden the `UPLOADS_DIR` env-var description**

In `README.md`, replace the `UPLOADS_DIR` table row (line ~51):

```
| `UPLOADS_DIR` | Absolute path where support ticket attachments are stored. Must point inside a Coolify persistent volume (e.g. `/data/uploads`) — otherwise attachments vanish on every container restart. Defaults to `./uploads` for local dev. |
```

with:

```
| `UPLOADS_DIR` | Absolute path where uploaded files are stored — support ticket attachments and the landing-page hero image/video. Must point inside a Coolify persistent volume (e.g. `/data/uploads`) — otherwise uploads vanish on every container restart. Defaults to `./uploads` for local dev. |
```

- [ ] **Step 2: Broaden section 5️⃣**

In `README.md`, replace the intro sentence of section "5️⃣ Mount a persistent volume for uploads" (line ~104):

```
Support tickets accept image attachments which are written to disk. Without a persistent volume, those files are wiped on every container restart.
```

with:

```
Support ticket attachments and the landing-page hero image/video are written to disk. Without a persistent volume, those files are wiped on every container restart. Both features share this one volume (the app stores them in `tickets/` and `landing/` subfolders).
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): note hero media shares the uploads volume"
```

---

## Final Verification

- [ ] **Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the four new files (`uploads.test.ts`, `heroMedia.test.ts`, `hero-media-actions.test.ts`, `hero-media-route.test.ts`).

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **End-to-end manual check**

With `npm run dev`: as admin, upload an image and confirm it shows on the logged-out landing page; replace it with a video and confirm autoplay/mute/loop; remove it and confirm the bundled photo returns.
