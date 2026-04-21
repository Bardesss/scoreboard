import { prisma } from '@/lib/prisma'
import DiscountCodesClient from './DiscountCodesClient'

export default async function DiscountCodesPage() {
  const codes = await prisma.discountCode.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return <DiscountCodesClient codes={codes} />
}
