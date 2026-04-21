import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import UserDetailClient from './UserDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params

  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        monthlyCredits: true,
        permanentCredits: true,
        isLifetimeFree: true,
        requiresMfa: true,
        totpEnabled: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    prisma.creditTransaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        delta: true,
        reason: true,
        createdAt: true,
      },
    }),
  ])

  if (!user) notFound()

  // Serialize dates to ISO strings for the client component
  const serializedUser = {
    ...user,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }

  const serializedTransactions = transactions.map((tx) => ({
    ...tx,
    createdAt: tx.createdAt.toISOString(),
  }))

  return (
    <UserDetailClient user={serializedUser} transactions={serializedTransactions} />
  )
}
