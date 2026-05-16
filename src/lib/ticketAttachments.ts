import { prisma } from '@/lib/prisma'
import { deleteAttachmentFile } from '@/lib/uploads'

export async function purgeTicketAttachments(ticketId: string): Promise<void> {
  const attachments = await prisma.ticketAttachment.findMany({
    where: { ticketId, deletedAt: null },
    select: { id: true, storageKey: true },
  })
  if (attachments.length === 0) return

  await Promise.all(attachments.map(a => deleteAttachmentFile(a.storageKey)))

  await prisma.ticketAttachment.updateMany({
    where: { id: { in: attachments.map(a => a.id) } },
    data: { deletedAt: new Date() },
  })
}
