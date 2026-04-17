import Mailgun from 'mailgun.js'
import FormData from 'form-data'

function createClient() {
  const mg = new Mailgun(FormData)
  return mg.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY!,
    url: 'https://api.eu.mailgun.net',
  })
}

async function send(to: string, subject: string, html: string) {
  const client = createClient()
  await client.messages.create(process.env.MAILGUN_DOMAIN!, {
    from: process.env.MAILGUN_FROM!,
    to,
    subject,
    html,
  })
}

export async function sendVerificationEmail(to: string, token: string, locale: string) {
  const link = `${process.env.NEXTAUTH_URL}/${locale}/auth/verify-email?token=${token}`
  const subject = locale === 'nl' ? 'Bevestig je e-mailadres — Dice Vault' : 'Verify your email — Dice Vault'
  const html = locale === 'nl'
    ? `<p>Klik op de link om je e-mailadres te bevestigen:</p><p><a href="${link}">${link}</a></p><p>De link is 24 uur geldig.</p>`
    : `<p>Click the link to verify your email address:</p><p><a href="${link}">${link}</a></p><p>The link is valid for 24 hours.</p>`
  await send(to, subject, html)
}

export async function sendPasswordResetEmail(to: string, token: string, locale: string) {
  const link = `${process.env.NEXTAUTH_URL}/${locale}/auth/reset-password?token=${token}`
  const subject = locale === 'nl' ? 'Wachtwoord resetten — Dice Vault' : 'Reset your password — Dice Vault'
  const html = locale === 'nl'
    ? `<p>Klik op de link om je wachtwoord te resetten:</p><p><a href="${link}">${link}</a></p><p>De link is 15 minuten geldig.</p>`
    : `<p>Click the link to reset your password:</p><p><a href="${link}">${link}</a></p><p>The link is valid for 15 minutes.</p>`
  await send(to, subject, html)
}
