import { prisma } from '@/lib/prisma'

export type FreeModeState = {
  active: boolean
  bannerNl: string
  bannerEn: string
}

const KEYS = ['free_mode_active', 'free_mode_banner_nl', 'free_mode_banner_en'] as const

export async function loadFreeModeState(): Promise<FreeModeState> {
  const rows = await prisma.adminSettings.findMany({
    where: { key: { in: ['free_mode_active', 'free_mode_banner_nl', 'free_mode_banner_en'] } },
  })
  const byKey = new Map<string, unknown>(rows.map(r => [r.key, r.value]))
  return {
    active: byKey.get('free_mode_active') === true,
    bannerNl: typeof byKey.get('free_mode_banner_nl') === 'string' ? (byKey.get('free_mode_banner_nl') as string) : '',
    bannerEn: typeof byKey.get('free_mode_banner_en') === 'string' ? (byKey.get('free_mode_banner_en') as string) : '',
  }
}

// Exported only so consumers don't redeclare the list.
export const FREE_MODE_KEYS = KEYS
