import Mailgun from 'mailgun.js'
import FormData from 'form-data'
import { getIntegrationConfig } from './integrations'
import { escapeHtml } from '@/lib/emailTemplates'

const SUPPORT_URL = 'https://dicevault.fun/app/support'

export async function isMailConfigured(): Promise<boolean> {
  const config = await getIntegrationConfig('mailgun')
  return !!(config?.apiKey && config?.domain && config?.from)
}

function footer(locale: string): string {
  const isNl = locale === 'nl'
  const noReply = isNl
    ? 'Dit is een geautomatiseerd bericht — antwoorden op deze e-mail worden niet gelezen.'
    : 'This is an automated message — replies to this email are not monitored.'
  const helpPrefix = isNl ? 'Hulp nodig? Open een ticket via ' : 'Need help? Open a ticket at '
  const helpLink = `<a href="${SUPPORT_URL}" style="color:#c27f0a;text-decoration:underline;">${SUPPORT_URL}</a>`
  return `<hr style="border:none;border-top:1px solid #e8e1d8;margin:24px 0 12px;" />` +
    `<p style="font-family:sans-serif;font-size:12px;color:#9a8878;line-height:1.5;margin:0;">` +
    `${noReply}<br />${helpPrefix}${helpLink}.` +
    `</p>`
}

async function send(to: string, subject: string, html: string, locale: string = 'en') {
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
    html: html + footer(locale),
  })
}

export async function sendVerificationEmail(to: string, token: string, locale: string, graceDays: number = 7) {
  const link = `${process.env.NEXTAUTH_URL}/${locale}/auth/verify-email?token=${token}`
  const subject = locale === 'nl' ? 'Bevestig je e-mailadres — Dice Vault' : 'Verify your email — Dice Vault'
  const d = graceDays
  const html = locale === 'nl'
    ? `<p>Klik op de link om je e-mailadres te bevestigen:</p><p><a href="${link}">${link}</a></p><p>De link is ${d} ${d === 1 ? 'dag' : 'dagen'} geldig. Als je je account niet binnen ${d} ${d === 1 ? 'dag' : 'dagen'} bevestigt, wordt het automatisch verwijderd.</p>`
    : `<p>Click the link to verify your email address:</p><p><a href="${link}">${link}</a></p><p>The link is valid for ${d} ${d === 1 ? 'day' : 'days'}. If you don't verify your account within ${d} ${d === 1 ? 'day' : 'days'}, it will be automatically removed.</p>`
  await send(to, subject, html, locale)
}

export async function sendEmail(to: string, subject: string, html: string, locale: string = 'en') {
  await send(to, subject, html, locale)
}

export async function sendPasswordResetEmail(to: string, token: string, locale: string) {
  const link = `${process.env.NEXTAUTH_URL}/${locale}/auth/reset-password?token=${token}`
  const subject = locale === 'nl' ? 'Wachtwoord resetten — Dice Vault' : 'Reset your password — Dice Vault'
  const html = locale === 'nl'
    ? `<p>Klik op de link om je wachtwoord te resetten:</p><p><a href="${link}">${link}</a></p><p>De link is 15 minuten geldig.</p>`
    : `<p>Click the link to reset your password:</p><p><a href="${link}">${link}</a></p><p>The link is valid for 15 minutes.</p>`
  await send(to, subject, html, locale)
}

export async function sendTicketRepliedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Nieuw antwoord op je supportticket`, body: `Het Dice Vault supportteam heeft gereageerd op je ticket: "${escapeHtml(subject)}". Log in om het antwoord te bekijken.` }
    : { emailSubject: `New reply to your support ticket`, body: `The Dice Vault support team replied to your ticket: "${escapeHtml(subject)}". Log in to view the reply.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`, locale)
}

export async function sendTicketClosedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je supportticket is gesloten`, body: `Je ticket "${escapeHtml(subject)}" is gesloten door ons supportteam.` }
    : { emailSubject: `Your support ticket has been closed`, body: `Your ticket "${escapeHtml(subject)}" has been closed by our support team.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`, locale)
}

export async function sendTicketAutoClosedEmail(to: string, subject: string, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je supportticket is automatisch gesloten`, body: `Je ticket "${escapeHtml(subject)}" is automatisch gesloten na 7 dagen zonder reactie. Als je nog hulp nodig hebt, open dan een nieuw ticket.` }
    : { emailSubject: `Your support ticket was automatically closed`, body: `Your ticket "${escapeHtml(subject)}" was automatically closed after 7 days without a reply. If you still need help, please open a new ticket.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`, locale)
}

export async function sendMonthlyResetEmail(to: string, credits: number, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je maandelijkse credits zijn gereset`, body: `Je Dice Vault maandelijkse credits zijn gereset naar ${credits}. Geniet van nog een maand gamen!` }
    : { emailSubject: `Your monthly credits have been reset`, body: `Your Dice Vault monthly credits have been reset to ${credits}. Enjoy another month of gaming!` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`, locale)
}

export async function sendLowCreditWarningEmail(to: string, balance: number, locale: string) {
  const strings = locale === 'nl'
    ? { emailSubject: `Je Dice Vault credits raken op`, body: `Je hebt nog ${balance} credits. Koop meer om zonder onderbreking games te blijven bijhouden.` }
    : { emailSubject: `Your Dice Vault credits are running low`, body: `You have ${balance} credits remaining. Top up to keep logging games without interruption.` }
  await sendEmail(to, strings.emailSubject, `<p>${strings.body}</p>`, locale)
}
