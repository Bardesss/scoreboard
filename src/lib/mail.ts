import Mailgun from 'mailgun.js'
import FormData from 'form-data'
import { getIntegrationConfig } from './integrations'

export async function isMailConfigured(): Promise<boolean> {
  const config = await getIntegrationConfig('mailgun')
  return !!(config?.apiKey && config?.domain && config?.from)
}

async function send(to: string, subject: string, html: string) {
  const config = await getIntegrationConfig('mailgun')
  if (!config?.apiKey || !config?.domain || !config?.from) return

  const mg = new Mailgun(FormData)
  const client = mg.client({
    username: 'api',
    key: config.apiKey,
    url: config.region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
  })

  await client.messages.create(config.domain, {
    from: config.from,
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

export async function sendEmail(to: string, subject: string, html: string) {
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

export async function sendTicketRepliedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Nieuw antwoord op je supportticket`, body: `Het Dice Vault supportteam heeft gereageerd op je ticket: "${subject}". Log in om het antwoord te bekijken.` }
    : { emailSubject: `New reply to your support ticket`, body: `The Dice Vault support team replied to your ticket: "${subject}". Log in to view the reply.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}

export async function sendTicketClosedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je supportticket is gesloten`, body: `Je ticket "${subject}" is gesloten door ons supportteam.` }
    : { emailSubject: `Your support ticket has been closed`, body: `Your ticket "${subject}" has been closed by our support team.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}

export async function sendTicketAutoClosedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je supportticket is automatisch gesloten`, body: `Je ticket "${subject}" is automatisch gesloten na 7 dagen zonder reactie. Als je nog hulp nodig hebt, open dan een nieuw ticket.` }
    : { emailSubject: `Your support ticket was automatically closed`, body: `Your ticket "${subject}" was automatically closed after 7 days without a reply. If you still need help, please open a new ticket.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}

export async function sendMonthlyResetEmail(to: string, credits: number, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je maandelijkse credits zijn gereset`, body: `Je Dice Vault maandelijkse credits zijn gereset naar ${credits}. Geniet van nog een maand gamen!` }
    : { emailSubject: `Your monthly credits have been reset`, body: `Your Dice Vault monthly credits have been reset to ${credits}. Enjoy another month of gaming!` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}

export async function sendLowCreditWarningEmail(to: string, balance: number, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je Dice Vault credits raken op`, body: `Je hebt nog ${balance} credits. Koop meer om zonder onderbreking games te blijven bijhouden.` }
    : { emailSubject: `Your Dice Vault credits are running low`, body: `You have ${balance} credits remaining. Top up to keep logging games without interruption.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`)
}
