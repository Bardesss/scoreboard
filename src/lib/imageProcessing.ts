import sharp from 'sharp'
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

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 82

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

// Resize + recompress. `sourceIsPng` controls whether transparency is
// preserved (PNG out) or flattened to JPEG (much smaller, fine for photos
// and opaque screenshots). `.rotate()` with no args bakes in EXIF orientation
// and strips the rest of the metadata as a side-effect.
async function recompress(buf: Buffer, sourceIsPng: boolean): Promise<ProcessedImage> {
  const base = sharp(buf, { failOn: 'none' })
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })

  if (sourceIsPng) {
    const meta = await sharp(buf).metadata()
    if (meta.hasAlpha) {
      const out = await base.png({ compressionLevel: 9 }).toBuffer()
      return { buffer: out, mimeType: 'image/png', ext: 'png', size: out.length }
    }
  }

  const out = await base.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
  return { buffer: out, mimeType: 'image/jpeg', ext: 'jpg', size: out.length }
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

  try {
    if (detected === 'image/jpeg' || detected === 'image/png') {
      return { ok: true, value: await recompress(buf, detected === 'image/png') }
    }

    // HEIC / HEIF — decode to a near-lossless JPEG, then run the same pipeline
    // so we only pay for resize once and end up with the same quality target.
    const heicConvert = (await import('heic-convert')).default as (opts: {
      buffer: ArrayBuffer | Buffer
      format: 'JPEG' | 'PNG'
      quality?: number
    }) => Promise<ArrayBuffer>
    const intermediate = Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 1 }))
    return { ok: true, value: await recompress(intermediate, false) }
  } catch (e) {
    console.error('[imageProcessing] processing failed', e)
    return { ok: false, error: 'conversion_failed' }
  }
}
