'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTicketRepliedEmail, sendTicketClosedEmail } from '@/lib/mail'
import { processUpload } from '@/lib/imageProcessing'
import { saveAttachment, ATTACHMENT_MAX_PER_MESSAGE } from '@/lib/uploads'
import { purgeTicketAttachments } from '@/lib/ticketAttachments'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

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

export async function adminReplyToTicket(
  ticketId: string,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  if (!await requireAdmin()) return { success: false, error: 'Unauthorized' }

  const body = (formData.get('body') as string)?.trim()
  if (!body) return { success: false, error: 'Missing body' }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { email: true, locale: true } } },
  })
  if (!ticket || ticket.status === 'closed') return { success: false, error: 'Not found or closed' }

  const files = await extractFiles(formData)

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const [message] = await Promise.all([
    prisma.ticketMessage.create({ data: { ticketId, senderType: 'admin', body } }),
    prisma.ticket.update({ where: { id: ticketId }, data: { autoCloseAt: sevenDaysFromNow } }),
  ])

  if (files.length > 0) {
    const r = await persistAttachments(ticketId, message.id, files)
    if (!r.success) return { success: false, error: r.error }
  }

  await sendTicketRepliedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})

  revalidatePath(`/admin/tickets/${ticketId}`)
  return { success: true }
}

export async function adminCloseTicket(
  ticketId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!await requireAdmin()) return { success: false, error: 'Unauthorized' }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { email: true, locale: true } } },
  })
  if (!ticket) return { success: false, error: 'Not found' }

  await purgeTicketAttachments(ticketId)
  await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'closed', autoCloseAt: null } })
  await sendTicketClosedEmail(ticket.user.email, ticket.subject, ticket.user.locale).catch(() => {})

  revalidatePath('/admin/tickets')
  revalidatePath(`/admin/tickets/${ticketId}`)
  return { success: true }
}
