'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processUpload } from '@/lib/imageProcessing'
import { saveAttachment, ATTACHMENT_MAX_PER_MESSAGE } from '@/lib/uploads'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { checkUserRateLimit } from '@/lib/credits'

const VALID_CATEGORIES = ['bug', 'feedback', 'question'] as const

type CreateResult =
  | { success: true; ticketId: string }
  | { success: false; error: string }

type ReplyResult =
  | { success: true }
  | { success: false; error: string }

function cuidLike(): string {
  return randomUUID().replace(/-/g, '').slice(0, 24)
}

async function extractFiles(fd: FormData): Promise<File[]> {
  const raw = fd.getAll('attachments')
  const files: File[] = []
  for (const v of raw) {
    if (v instanceof File && v.size > 0) files.push(v)
  }
  return files
}

async function persistAttachments(
  ticketId: string,
  messageId: string,
  files: File[]
): Promise<{ success: true } | { success: false; error: string }> {
  if (files.length > ATTACHMENT_MAX_PER_MESSAGE) {
    return { success: false, error: 'attachments_too_many' }
  }
  for (const file of files) {
    const result = await processUpload(file)
    if (!result.ok) return { success: false, error: `attachment_${result.error}` }

    const attachmentId = cuidLike()
    const storageKey = await saveAttachment(
      ticketId,
      attachmentId,
      result.value.ext,
      result.value.buffer
    )
    await prisma.ticketAttachment.create({
      data: {
        id: attachmentId,
        ticketId,
        messageId,
        filename: file.name.slice(0, 200),
        storageKey,
        mimeType: result.value.mimeType,
        size: result.value.size,
      },
    })
  }
  return { success: true }
}

export async function createTicket(formData: FormData): Promise<CreateResult> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  // Throttle: prevent support-inbox flooding.
  if (!(await checkUserRateLimit(session.user.id, 'create_ticket', 5, 60 * 60))) {
    return { success: false, error: 'Too many tickets — please wait a while before creating another.' }
  }

  const category = formData.get('category') as string
  const subject = (formData.get('subject') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()

  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return { success: false, error: 'Invalid category' }
  }
  if (!subject || !body) return { success: false, error: 'Missing fields' }

  const files = await extractFiles(formData)

  const ticket = await prisma.ticket.create({
    data: { userId: session.user.id, category, subject, status: 'open' },
  })
  const message = await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, senderType: 'user', body },
  })

  if (files.length > 0) {
    const r = await persistAttachments(ticket.id, message.id, files)
    if (!r.success) return { success: false, error: r.error }
  }

  revalidatePath('/app/support')
  return { success: true, ticketId: ticket.id }
}

export async function replyToTicket(
  ticketId: string,
  formData: FormData
): Promise<ReplyResult> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const body = (formData.get('body') as string)?.trim()
  if (!body) return { success: false, error: 'Missing body' }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket || ticket.userId !== session.user.id) return { success: false, error: 'Not found' }
  if (ticket.status === 'closed') return { success: false, error: 'Ticket is closed' }

  const files = await extractFiles(formData)

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const [message] = await Promise.all([
    prisma.ticketMessage.create({ data: { ticketId, senderType: 'user', body } }),
    prisma.ticket.update({ where: { id: ticketId }, data: { autoCloseAt: sevenDaysFromNow } }),
  ])

  if (files.length > 0) {
    const r = await persistAttachments(ticketId, message.id, files)
    if (!r.success) return { success: false, error: r.error }
  }

  revalidatePath(`/app/support/${ticketId}`)
  return { success: true }
}
