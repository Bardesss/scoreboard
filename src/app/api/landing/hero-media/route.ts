import { NextResponse } from 'next/server'
import { getHeroMedia } from '@/lib/heroMedia'
import { openUploadStream } from '@/lib/uploads'

// Public landing-page asset — no auth. The consuming page appends ?v=<uploadedAt>,
// so every upload produces a new URL; the old cached entry is simply abandoned.
// This makes the URL effectively content-addressed, so a 1-year immutable cache is safe.
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
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
