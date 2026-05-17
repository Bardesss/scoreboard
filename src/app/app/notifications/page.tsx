import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { NotificationsClient } from './NotificationsClient'
import { PageHeader } from '@/components/shared/PageHeader'

const PAGE_SIZE = 20

type PageProps = {
  searchParams: Promise<{ page?: string; filter?: string }>
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const filter = sp.filter === 'unread' ? 'unread' : 'all'

  const where = filter === 'unread'
    ? { userId: session.user.id, read: false }
    : { userId: session.user.id }

  const [total, items, t] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    getTranslations({ locale: session.user.locale ?? 'en', namespace: 'app.notifications' }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const serialized = items.map(n => ({
    id: n.id,
    type: n.type,
    meta: (n.meta as Record<string, unknown> | null) ?? null,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }))

  return (
    <div className="max-w-4xl mx-auto py-8">
      <PageHeader title={t('pageTitle')} subtitle={t('pageSubtitle')} />
      <NotificationsClient
        notifications={serialized}
        page={page}
        totalPages={totalPages}
        filter={filter}
        locale={session.user.locale ?? 'en'}
      />
    </div>
  )
}
