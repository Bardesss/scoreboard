import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ReactMarkdown from 'react-markdown'
import type { Metadata } from 'next'
import { buildOpenGraph, localizedAlternates } from '@/lib/seo'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const page = await prisma.page.findUnique({ where: { slug } })
  if (!page || !page.published) return {}

  const title = locale === 'nl' ? page.titleNl : page.titleEn
  const content = locale === 'nl' ? page.contentNl : page.contentEn
  // First ~160 chars of body, markdown syntax stripped, as the meta description.
  const description = content
    .replace(/[#*_`>[\]()!-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)

  return {
    title,
    description,
    alternates: localizedAlternates(locale, `/p/${slug}`),
    openGraph: buildOpenGraph({ locale, title, description, path: `/p/${slug}` }),
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PublicPage({ params }: PageProps) {
  const { locale, slug } = await params
  const page = await prisma.page.findUnique({ where: { slug } })
  if (!page || !page.published) notFound()

  const title = locale === 'nl' ? page.titleNl : page.titleEn
  const content = locale === 'nl' ? page.contentNl : page.contentEn

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="font-headline font-black text-3xl mb-8" style={{ color: '#1e1a14' }}>
        {title}
      </h1>
      <div className="font-body prose prose-amber max-w-none" style={{ color: '#4a3f2f' }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
