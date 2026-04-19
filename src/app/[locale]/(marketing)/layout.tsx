import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import CookieBanner from '@/components/layout/CookieBanner'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params
  return (
    <>
      <Header locale={locale} />
      <main className="relative z-10">{children}</main>
      <Footer locale={locale} />
      <CookieBanner />
    </>
  )
}
