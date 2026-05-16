import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES } from './uploads'

export type ProcessedImage = {
  buffer: Buffer
  mimeType: 'image/jpeg' | 'image/png'
  ext: 'jpg' | 'png'
  size: number
}

export type ImageValidationError =
  | 'invalid_type'
  | 'too_large'
  | 'unreadable'
  | 'conversion_failed'

function detectMimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.slice(8, 12).toString('ascii')
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx' || brand === 'heim' || brand === 'heis') return 'image/heic'
    if (brand === 'mif1' || brand === 'msf1' || brand === 'heif') return 'image/heif'
  }
  return null
}

export async function processUpload(
  file: File
): Promise<{ ok: true; value: ProcessedImage } | { ok: false; error: ImageValidationError }> {
  if (file.size > ATTACHMENT_MAX_BYTES) return { ok: false, error: 'too_large' }

  const declared = file.type
  if (!ATTACHMENT_MIME_TYPES.includes(declared as typeof ATTACHMENT_MIME_TYPES[number])) {
    return { ok: false, error: 'invalid_type' }
  }

  let buf: Buffer
  try {
    buf = Buffer.from(await file.arrayBuffer())
  } catch {
    return { ok: false, error: 'unreadable' }
  }

  const detected = detectMimeFromMagic(buf)
  if (!detected) return { ok: false, error: 'invalid_type' }

  if (detected === 'image/jpeg') {
    return { ok: true, value: { buffer: buf, mimeType: 'image/jpeg', ext: 'jpg', size: buf.length } }
  }
  if (detected === 'image/png') {
    return { ok: true, value: { buffer: buf, mimeType: 'image/png', ext: 'png', size: buf.length } }
  }

  // HEIC / HEIF — convert to JPEG so all browsers can render it
  try {
    const heicConvert = (await import('heic-convert')).default as (opts: {
      buffer: ArrayBuffer | Buffer
      format: 'JPEG' | 'PNG'
      quality?: number
    }) => Promise<ArrayBuffer>
    const out = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 })
    const jpeg = Buffer.from(out)
    return { ok: true, value: { buffer: jpeg, mimeType: 'image/jpeg', ext: 'jpg', size: jpeg.length } }
  } catch (e) {
    console.error('[imageProcessing] HEIC conversion failed', e)
    return { ok: false, error: 'conversion_failed' }
  }
}
