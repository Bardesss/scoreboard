import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PageForm from '../PageForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditPagePage({ params }: PageProps) {
  const { id } = await params
  const page = await prisma.page.findUnique({ where: { id } })
  if (!page) notFound()

  return (
    <PageForm
      mode="edit"
      page={{
        id: page.id,
        slug: page.slug,
        isSystem: page.isSystem,
        titleNl: page.titleNl,
        titleEn: page.titleEn,
        contentNl: page.contentNl,
        contentEn: page.contentEn,
        published: page.published,
        order: page.order,
      }}
    />
  )
}
