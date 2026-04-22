import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import TicketReplyForm from './TicketReplyForm'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  const t = await getTranslations({ locale, namespace: 'app.support' })

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!ticket || ticket.userId !== session.user.id) notFound()

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="mb-6">
        <h1 className="font-headline font-black text-xl mb-2" style={{ color: '#1c1810' }}>{ticket.subject}</h1>
        <span
          className="font-headline font-bold text-xs"
          style={{ color: ticket.status === 'open' ? '#16a34a' : '#9a8878' }}
        >
          {ticket.status === 'open' ? t('open') : t('closed')}
        </span>
      </div>

      {ticket.status === 'open' && ticket.autoCloseAt && (
        <p className="font-body text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: '#fef9e7', color: '#92400e', border: '1px solid #fde68a' }}>
          {t('autoCloseNotice', { date: ticket.autoCloseAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB') })}
        </p>
      )}

      <div className="space-y-3 mb-6">
        {ticket.messages.map(msg => {
          const isUser = msg.senderType === 'user'
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl px-4 py-3"
                style={{
                  background: isUser ? '#fef3e2' : '#fffdf9',
                  border: isUser ? '1px solid #fde68a' : '1px solid #e8e1d8',
                }}
              >
                <p className="font-headline font-bold text-xs mb-1" style={{ color: '#9a8878' }}>
                  {isUser ? session.user.email : t('admin')}
                </p>
                <p className="font-body text-sm whitespace-pre-wrap" style={{ color: '#1c1810', margin: 0 }}>{msg.body}</p>
                <p className="font-body text-xs mt-2" style={{ color: '#c4b79a', margin: 0 }}>
                  {msg.createdAt.toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB')}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {ticket.status === 'closed' ? (
        <p className="font-body text-sm" style={{ color: '#9a8878' }}>{t('closedNotice')}</p>
      ) : (
        <TicketReplyForm ticketId={id} replyLabel={t('reply')} placeholder={t('replyPlaceholder')} />
      )}
    </div>
  )
}
