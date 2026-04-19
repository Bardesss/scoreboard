import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

const meta: Record<string, { title: string; description: string }> = {
  nl: {
    title: 'Dice Vault — Onthoud wie er echt gewonnen heeft.',
    description: 'Log elke spelletjesavond, volg statistieken en beslis discussies voorgoed. Het scorebord van jouw groep, in één kluis.',
  },
  en: {
    title: 'Dice Vault — Remember who actually won.',
    description: 'Log every game night, track stats, and settle debates once and for all. Your group\'s scoreboard, all in one vault.',
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const m = meta[locale] ?? meta.en
  return {
    title: m.title,
    description: m.description,
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!(routing.locales as readonly string[]).includes(locale)) notFound()
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
