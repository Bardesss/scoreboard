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
