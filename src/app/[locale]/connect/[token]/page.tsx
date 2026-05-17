import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AuthCard, PrimaryButton } from '@/components/auth/AuthCard'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/mail'
import { shouldSendEmailTo } from '@/lib/emailPreferences'
import { connectionAcceptedEmail } from '@/lib/emailTemplates'
import { startConnectLogin, startConnectRegister } from './actions'

type PageProps = {
  params: Promise<{ locale: string; token: string }>
}

export default async function ConnectPage({ params }: PageProps) {
  const { locale, token } = await params
  const t = await getTranslations({ locale, namespace: 'auth.connect' })

  const target = await prisma.user.findUnique({
    where: { connectToken: token },
    select: { id: true, email: true, username: true },
  })

  if (!target) {
    return (
      <AuthCard>
        <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-2">{t('invalid.title')}</h1>
        <p className="font-body text-[14px] text-on-surface-variant">{t('invalid.body')}</p>
      </AuthCard>
    )
  }

  const session = await auth()
  const targetName = target.username ?? target.email

  // Not logged in → CTA to sign in or sign up
  if (!session) {
    const loginAction = startConnectLogin.bind(null, token, locale)
    const registerAction = startConnectRegister.bind(null, token, locale)
    return (
      <AuthCard>
        <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-2">
          {t('cta.title', { name: targetName })}
        </h1>
        <p className="font-body text-[14px] text-on-surface-variant mb-6">{t('cta.body')}</p>

        <form action={registerAction}>
          <PrimaryButton type="submit" className="mb-3">{t('cta.register')}</PrimaryButton>
        </form>
        <form action={loginAction}>
          <button
            type="submit"
            className="w-full h-11 rounded-xl font-headline font-bold text-[14px] border"
            style={{ borderColor: '#e8e1d8', color: '#1e1a14', background: '#fefcf8' }}
          >
            {t('cta.login')}
          </button>
        </form>
      </AuthCard>
    )
  }

  // Self-scan → bounce to profile
  if (session.user.id === target.id) {
    redirect('/app/profile')
  }

  // Already connected → just open the link picker for that connection
  const existing = await prisma.vaultConnection.findFirst({
    where: { userId: session.user.id, connectedUserId: target.id },
  })
  if (existing) {
    redirect(`/app/players?linkWith=${target.id}&already=1`)
  }

  // New connection — create bidirectional VaultConnection
  await prisma.vaultConnection.createMany({
    data: [
      { userId: session.user.id, connectedUserId: target.id },
      { userId: target.id, connectedUserId: session.user.id },
    ],
    skipDuplicates: true,
  })

  // Also resolve any pending request between them (if either side had sent one)
  await prisma.connectionRequest.updateMany({
    where: {
      status: 'pending',
      OR: [
        { fromUserId: session.user.id, toUserId: target.id },
        { fromUserId: target.id, toUserId: session.user.id },
      ],
    },
    data: { status: 'accepted' },
  })

  // Notify the other side
  await createNotification(target.id, 'connection_accepted', {
    fromEmail: session.user.email,
  })

  // Fire-and-forget email
  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: target.id },
      select: { email: true, locale: true },
    })
    if (targetUser?.email && await shouldSendEmailTo(target.id, 'connection_accepted')) {
      const acceptorName = session.user.email ?? session.user.id
      const tpl = connectionAcceptedEmail(targetUser.locale ?? 'en', acceptorName)
      sendEmail(targetUser.email, tpl.subject, tpl.html).catch(() => {})
    }
  } catch { /* email failure must not break the flow */ }

  redirect(`/app/players?linkWith=${target.id}`)
}
