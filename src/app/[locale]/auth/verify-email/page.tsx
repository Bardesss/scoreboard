import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { verifyEmail } from '../actions'
import { AuthCard } from '@/components/auth/AuthCard'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }

export default async function VerifyEmailPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { token } = await searchParams
  const t = await getTranslations('auth')

  let success = false
  let error = ''

  if (token) {
    const result = await verifyEmail(token)
    if (result && 'error' in result) {
      error = result.error
    } else {
      success = true
    }
  }

  return (
    <AuthCard>
      <div className="text-center py-4">
        <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-3">
          {success ? t('verify.success') : error ? t(error as any) : t('verify.verifying')}
        </h1>
        {(success || error) && (
          <Link href={`/${locale}/auth/login`} className="font-body text-[13px] text-primary hover:underline">
            {t('verify.login')}
          </Link>
        )}
      </div>
    </AuthCard>
  )
}
