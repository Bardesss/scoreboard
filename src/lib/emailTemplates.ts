const APP_URL = process.env.NEXTAUTH_URL ?? 'https://dicevault.app'

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">${label}</a>`
}

function wrap(content: string): string {
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">${content}</div>`
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
        `<p><strong>${fromName}</strong> wil graag verbinding maken met je op Dice Vault.</p>` +
        `<p>Open de app om het verzoek te accepteren of te weigeren.</p>` +
        button('Verzoek bekijken', `${appUrl}/nl/app/connections`)
      ),
    }
  }
  return {
    subject: 'You have received a connection request',
    html: wrap(
      `<p><strong>${fromName}</strong> wants to connect with you on Dice Vault.</p>` +
      `<p>Open the app to accept or decline the request.</p>` +
      button('View request', `${appUrl}/en/app/connections`)
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
        `<p><strong>${toName}</strong> heeft je verbindingsverzoek geaccepteerd op Dice Vault.</p>` +
        `<p>Je bent nu verbonden en kunt elkaars scores zien.</p>` +
        button('Ga naar verbindingen', `${appUrl}/nl/app/connections`)
      ),
    }
  }
  return {
    subject: 'Your connection request has been accepted',
    html: wrap(
      `<p><strong>${toName}</strong> has accepted your connection request on Dice Vault.</p>` +
      `<p>You are now connected and can view each other's scores.</p>` +
      button('Go to connections', `${appUrl}/en/app/connections`)
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
        `<p><strong>${submitterName}</strong> heeft een nieuwe partij ingediend in de competitie <strong>${leagueName}</strong>.</p>` +
        `<p>Bekijk de partij en keur hem goed of af.</p>` +
        button('Partij bekijken', `${appUrl}/nl/app/leagues`)
      ),
    }
  }
  return {
    subject: 'New game awaiting approval',
    html: wrap(
      `<p><strong>${submitterName}</strong> has submitted a new game in league <strong>${leagueName}</strong>.</p>` +
      `<p>Review the game and approve or reject it.</p>` +
      button('View game', `${appUrl}/en/app/leagues`)
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
        `<p>Je ingediende partij in de competitie <strong>${leagueName}</strong> is goedgekeurd.</p>` +
        `<p>De scores zijn nu zichtbaar in het klassement.</p>` +
        button('Bekijk klassement', `${appUrl}/nl/app/leagues`)
      ),
    }
  }
  return {
    subject: 'Your game has been approved',
    html: wrap(
      `<p>Your submitted game in league <strong>${leagueName}</strong> has been approved.</p>` +
      `<p>The scores are now visible in the standings.</p>` +
      button('View standings', `${appUrl}/en/app/leagues`)
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
        `<p>Je ingediende partij in de competitie <strong>${leagueName}</strong> is helaas afgewezen.</p>` +
        `<p>Neem contact op met de competitiebeheerder voor meer informatie.</p>` +
        button('Ga naar competitie', `${appUrl}/nl/app/leagues`)
      ),
    }
  }
  return {
    subject: 'Your game has been rejected',
    html: wrap(
      `<p>Your submitted game in league <strong>${leagueName}</strong> has been rejected.</p>` +
      `<p>Contact the league owner for more information.</p>` +
      button('Go to league', `${appUrl}/en/app/leagues`)
    ),
  }
}
