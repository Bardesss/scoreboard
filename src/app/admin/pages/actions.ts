'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<void> {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    throw new Error('Unauthorized')
  }
}

export async function createPage(input: {
  slug: string
  titleNl: string
  titleEn: string
  contentNl: string
  contentEn: string
  published: boolean
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    await requireAdmin()

    if (!/^[a-z0-9-]+$/.test(input.slug)) {
      return { success: false, error: 'slugInvalid' }
    }

    const existing = await prisma.page.findUnique({ where: { slug: input.slug } })
    if (existing) {
      return { success: false, error: 'slugTaken' }
    }

    const count = await prisma.page.count()

    const page = await prisma.page.create({
      data: {
        slug: input.slug,
        titleNl: input.titleNl.trim(),
        titleEn: input.titleEn.trim(),
        contentNl: input.contentNl,
        contentEn: input.contentEn,
        published: input.published,
        order: count,
      },
    })

    revalidatePath('/admin/pages')
    return { success: true, id: page.id }
  } catch {
    return { success: false, error: 'Aanmaken mislukt' }
  }
}

export async function updatePage(
  id: string,
  input: {
    titleNl: string
    titleEn: string
    contentNl: string
    contentEn: string
    published: boolean
    order: number
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    await prisma.page.update({
      where: { id },
      data: {
        titleNl: input.titleNl.trim(),
        titleEn: input.titleEn.trim(),
        contentNl: input.contentNl,
        contentEn: input.contentEn,
        published: input.published,
        order: input.order,
      },
    })

    revalidatePath('/admin/pages')
    return { success: true }
  } catch {
    return { success: false, error: 'Opslaan mislukt' }
  }
}

export async function deletePage(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    const page = await prisma.page.findUnique({ where: { id }, select: { isSystem: true } })
    if (!page) return { success: false, error: 'Niet gevonden' }
    if (page.isSystem) return { success: false, error: 'systemPage' }

    await prisma.page.delete({ where: { id } })

    revalidatePath('/admin/pages')
    return { success: true }
  } catch {
    return { success: false, error: 'Verwijderen mislukt' }
  }
}
