import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CreditsClient } from './CreditsClient'

const PAGE_SIZE = 20

type PageProps = {
  searchParams: Promise<{ page?: string }>
}

export default async function CreditsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const locale = session.user.locale ?? 'en'

  const [user, txCount, transactions, t] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { monthlyCredits: true, permanentCredits: true, isLifetimeFree: true },
    }),
    prisma.creditTransaction.count({ where: { userId: session.user.id } }),
    prisma.creditTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: { id: true, delta: true, pool: true, reason: true, meta: true, createdAt: true },
    }),
    getTranslations({ locale, namespace: 'app.credits' }),
  ])
  if (!user) redirect('/en/auth/login')

  const totalPages = Math.max(1, Math.ceil(txCount / PAGE_SIZE))

  const serializedTransactions = transactions.map(tx => ({
    id: tx.id,
    delta: tx.delta,
    pool: tx.pool,
    reason: tx.reason,
    meta: (tx.meta as Record<string, unknown> | null) ?? null,
    createdAt: tx.createdAt.toISOString(),
  }))

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <header className="mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>
          {t('pageTitle')}
        </h1>
        <p className="font-body text-sm mt-1" style={{ color: '#9a8878' }}>
          {t('subtitle')}
        </p>
      </header>

      <CreditsClient
        monthlyCredits={user.monthlyCredits}
        permanentCredits={user.permanentCredits}
        isLifetimeFree={user.isLifetimeFree}
        transactions={serializedTransactions}
        page={page}
        totalPages={totalPages}
        locale={locale === 'nl' ? 'nl' : 'en'}
      />
    </div>
  )
}
