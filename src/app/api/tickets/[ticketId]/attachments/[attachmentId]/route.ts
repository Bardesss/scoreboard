import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readAttachment } from '@/lib/uploads'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticketId: string; attachmentId: string }> }
) {
  const { ticketId, attachmentId } = await params

  const session = await auth()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const attachment = await prisma.ticketAttachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: { select: { id: true, userId: true } } },
  })

  if (!attachment || attachment.ticketId !== ticketId) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (attachment.deletedAt) {
    return new NextResponse('Gone', { status: 410 })
  }

  const isOwner = attachment.ticket.userId === session.user.id
  const isAdmin = session.user.role === 'admin'
  if (!isOwner && !isAdmin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let buffer: Buffer
  try {
    buffer = await readAttachment(attachment.storageKey)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }

  const safeName = attachment.filename.replace(/[\r\n"]/g, '_')
  const body = new Uint8Array(buffer)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
