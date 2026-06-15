const APP_URL = process.env.NEXTAUTH_URL ?? 'https://dicevault.app'

export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#f5a623;color:#1e1a14;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">${label}</a>`
}

function footer(locale: string, appUrl: string): string {
  const href = `${appUrl}/${locale}/app/settings`
  const link = `<a href="${href}" style="color:#9a8878;text-decoration:underline;">${
    locale === 'nl' ? 'E-mailvoorkeuren beheren' : 'Manage your email preferences'
  }</a>`
  const intro =
    locale === 'nl'
      ? 'Je ontvangt deze e-mail omdat meldingen aanstaan voor je account.'
      : "You're receiving this email because notifications are on for your account."
  return `${intro} ${link}.`
}

// Shared, email-client-safe layout: table-based, inline styles, brand palette.
// Kept deliberately minimal — a wordmark header, the message, and a footer that
// links back to the email preferences page in the recipient's locale.
function wrap(content: string, locale: string, appUrl: string): string {
  return (
    `<div style="background:#f0ebe3;margin:0;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:520px;background:#fefcf8;border:1px solid #e8e1d8;border-radius:20px;">` +
    `<tr><td style="padding:24px 32px 0 32px;">` +
    `<span style="font-size:18px;font-weight:800;color:#1e1a14;letter-spacing:-0.01em;border-bottom:3px solid #f5a623;padding-bottom:2px;">Dice Vault</span>` +
    `</td></tr>` +
    `<tr><td style="padding:16px 32px 24px 32px;color:#1e1a14;font-size:15px;line-height:1.55;">${content}</td></tr>` +
    `<tr><td style="padding:18px 32px;border-top:1px solid #f0ebe3;color:#9a8878;font-size:12px;line-height:1.5;">${footer(locale, appUrl)}</td></tr>` +
    `</table>` +
    `</td></tr>` +
    `</table>` +
    `</div>`
  )
}

export function connectionRequestEmail(
  locale: string,
  fromName: string,
  appUrl: string = APP_URL
): { subject: string; html: string } {
  if (locale === 'nl') {
    return {
      subject: 'Je hebt een verbindingsverzoek ontvangen',
      html: wrap(
        `<p><strong>${escapeHtml(fromName)}</strong> wil graag verbinding maken met je op Dice Vault.</p>` +
        `<p>Open de app om het verzoek te accepteren of te weigeren.</p>` +
        button('Verzoek bekijken', `${appUrl}/nl/app/connections`),
        locale,
        appUrl
      ),
    }
  }
  return {
    subject: 'You have received a connection request',
    html: wrap(
      `<p><strong>${escapeHtml(fromName)}</strong> wants to connect with you on Dice Vault.</p>` +
      `<p>Open the app to accept or decline the request.</p>` +
      button('View request', `${appUrl}/en/app/connections`),
      locale,
      appUrl
    ),
  }
}

export function connectionAcceptedEmail(
  locale: string,
  toName: string,
  appUrl: string = APP_URL
): { subject: string; html: string } {
  if (locale === 'nl') {
    return {
      subject: 'Je verbindingsverzoek is geaccepteerd',
      html: wrap(
        `<p><strong>${escapeHtml(toName)}</strong> heeft je verbindingsverzoek geaccepteerd op Dice Vault.</p>` +
        `<p>Je bent nu verbonden en kunt elkaars scores zien.</p>` +
        button('Ga naar verbindingen', `${appUrl}/nl/app/connections`),
        locale,
        appUrl
      ),
    }
  }
  return {
    subject: 'Your connection request has been accepted',
    html: wrap(
      `<p><strong>${escapeHtml(toName)}</strong> has accepted your connection request on Dice Vault.</p>` +
      `<p>You are now connected and can view each other's scores.</p>` +
      button('Go to connections', `${appUrl}/en/app/connections`),
      locale,
      appUrl
    ),
  }
}

export function playedGamePendingEmail(
  locale: string,
  leagueName: string,
  submitterName: string,
  appUrl: string = APP_URL
): { subject: string; html: string } {
  if (locale === 'nl') {
    return {
      subject: 'Nieuwe partij wacht op goedkeuring',
      html: wrap(
        `<p><strong>${escapeHtml(submitterName)}</strong> heeft een nieuwe partij ingediend in de competitie <strong>${escapeHtml(leagueName)}</strong>.</p>` +
        `<p>Bekijk de partij en keur hem goed of af.</p>` +
        button('Partij bekijken', `${appUrl}/nl/app/leagues`),
        locale,
        appUrl
      ),
    }
  }
  return {
    subject: 'New game awaiting approval',
    html: wrap(
      `<p><strong>${escapeHtml(submitterName)}</strong> has submitted a new game in league <strong>${escapeHtml(leagueName)}</strong>.</p>` +
      `<p>Review the game and approve or reject it.</p>` +
      button('View game', `${appUrl}/en/app/leagues`),
      locale,
      appUrl
    ),
  }
}

export function playedGameApprovedEmail(
  locale: string,
  leagueName: string,
  appUrl: string = APP_URL
): { subject: string; html: string } {
  if (locale === 'nl') {
    return {
      subject: 'Je partij is goedgekeurd',
      html: wrap(
        `<p>Je ingediende partij in de competitie <strong>${escapeHtml(leagueName)}</strong> is goedgekeurd.</p>` +
        `<p>De scores zijn nu zichtbaar in het klassement.</p>` +
        button('Bekijk klassement', `${appUrl}/nl/app/leagues`),
        locale,
        appUrl
      ),
    }
  }
  return {
    subject: 'Your game has been approved',
    html: wrap(
      `<p>Your submitted game in league <strong>${escapeHtml(leagueName)}</strong> has been approved.</p>` +
      `<p>The scores are now visible in the standings.</p>` +
      button('View standings', `${appUrl}/en/app/leagues`),
      locale,
      appUrl
    ),
  }
}

export function connectionGameLoggedEmail(
  locale: string,
  leagueName: string,
  actorEmail: string,
  appUrl: string = APP_URL
): { subject: string; html: string } {
  if (locale === 'nl') {
    return {
      subject: 'Nieuwe partij in jouw league',
      html: wrap(
        `<p><strong>${escapeHtml(actorEmail)}</strong> heeft net een nieuwe partij gelogd in <strong>${escapeHtml(leagueName)}</strong>.</p>` +
        `<p>Bekijk de scorecard in je activiteitenfeed.</p>` +
        button('Ga naar feed', `${appUrl}/nl/app/profile`),
        locale,
        appUrl
      ),
    }
  }
  return {
    subject: 'New game in your league',
    html: wrap(
      `<p><strong>${escapeHtml(actorEmail)}</strong> just logged a new game in <strong>${escapeHtml(leagueName)}</strong>.</p>` +
      `<p>See the scorecard in your activity feed.</p>` +
      button('Go to feed', `${appUrl}/en/app/profile`),
      locale,
      appUrl
    ),
  }
}

export function reactionReceivedEmail(
  locale: string,
  emoji: string,
  actorEmail: string,
  appUrl: string = APP_URL
): { subject: string; html: string } {
  if (locale === 'nl') {
    return {
      subject: `Iemand reageerde ${escapeHtml(emoji)} op je partij`,
      html: wrap(
        `<p><strong>${escapeHtml(actorEmail)}</strong> reageerde ${escapeHtml(emoji)} op je laatste partij.</p>` +
        `<p>Bekijk het in je activiteitenfeed.</p>` +
        button('Ga naar feed', `${appUrl}/nl/app/profile`),
        locale,
        appUrl
      ),
    }
  }
  return {
    subject: `Someone reacted ${escapeHtml(emoji)} on your game`,
    html: wrap(
      `<p><strong>${escapeHtml(actorEmail)}</strong> reacted ${escapeHtml(emoji)} to your latest game.</p>` +
      `<p>See it in your activity feed.</p>` +
      button('Go to feed', `${appUrl}/en/app/profile`),
      locale,
      appUrl
    ),
  }
}

export function playedGameRejectedEmail(
  locale: string,
  leagueName: string,
  appUrl: string = APP_URL
): { subject: string; html: string } {
  if (locale === 'nl') {
    return {
      subject: 'Je partij is afgewezen',
      html: wrap(
        `<p>Je ingediende partij in de competitie <strong>${escapeHtml(leagueName)}</strong> is helaas afgewezen.</p>` +
        `<p>Neem contact op met de competitiebeheerder voor meer informatie.</p>` +
        button('Ga naar competitie', `${appUrl}/nl/app/leagues`),
        locale,
        appUrl
      ),
    }
  }
  return {
    subject: 'Your game has been rejected',
    html: wrap(
      `<p>Your submitted game in league <strong>${escapeHtml(leagueName)}</strong> has been rejected.</p>` +
      `<p>Contact the league owner for more information.</p>` +
      button('Go to league', `${appUrl}/en/app/leagues`),
      locale,
      appUrl
    ),
  }
}
