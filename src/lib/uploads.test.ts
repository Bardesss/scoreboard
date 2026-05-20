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
