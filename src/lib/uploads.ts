import { promises as fs } from 'fs'
import path from 'path'

export const ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'] as const
export const ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024
export const ATTACHMENT_MAX_PER_MESSAGE = 4

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
}

export function resolveStoragePath(storageKey: string): string {
  const root = getUploadsDir()
  const full = path.resolve(root, storageKey)
  const rootResolved = path.resolve(root)
  if (!full.startsWith(rootResolved + path.sep) && full !== rootResolved) {
    throw new Error('Path traversal blocked')
  }
  return full
}

export async function saveAttachment(
  ticketId: string,
  attachmentId: string,
  ext: 'jpg' | 'png',
  data: Buffer | Uint8Array
): Promise<string> {
  const storageKey = path.posix.join('tickets', ticketId, `${attachmentId}.${ext}`)
  const full = resolveStoragePath(storageKey)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, data)
  return storageKey
}

export async function readAttachment(storageKey: string): Promise<Buffer> {
  const full = resolveStoragePath(storageKey)
  return fs.readFile(full)
}

export async function deleteAttachmentFile(storageKey: string): Promise<void> {
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
