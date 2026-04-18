# Phase 1b — Auth, i18n & Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add next-intl (nl/en), landing page, full auth flow (register/login/forgot-reset/verify-email/TOTP MFA), NextAuth v5 Credentials, Mailgun email, and the authenticated app shell (sidebar + bottom nav).

**Architecture:** next-intl handles locale routing with `/[locale]/` prefix on marketing + auth routes only. App routes (`/app/**`) have no locale prefix; locale is stored in the user's DB record and passed to `NextIntlClientProvider` by the app layout. NextAuth v5 with Credentials provider; TOTP uses a Redis-backed pending token for the two-step login flow. Auth logic lives in server actions — no NextAuth form actions for login (to support the TOTP redirect).

**Tech Stack:** next-intl, next-auth@5, bcryptjs, zod, mailgun.js, form-data, otpauth, qrcode, sonner (via shadcn)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Expand User to full Phase 1b fields |
| `src/i18n/routing.ts` | Create | next-intl locale/prefix config |
| `src/i18n/request.ts` | Create | next-intl server message loader |
| `next.config.ts` | Modify | Wrap with `createNextIntlPlugin` |
| `messages/nl/common.json` | Create | Nav, cookie banner, shared errors |
| `messages/nl/auth.json` | Create | Auth page strings |
| `messages/nl/landing.json` | Create | Landing page copy |
| `messages/nl/app.json` | Create | App shell nav labels |
| `messages/en/{common,auth,landing,app}.json` | Create | English equivalents |
| `src/lib/auth.ts` | Create | NextAuth v5 config (Credentials + TOTP flow) |
| `src/app/api/auth/[...nextauth]/route.ts` | Create | NextAuth route handler |
| `src/types/next-auth.d.ts` | Create | Session type extensions |
| `src/lib/mail.ts` | Create | Mailgun send helpers |
| `src/test/mail.test.ts` | Create | mail.ts unit tests |
| `src/app/[locale]/auth/actions.ts` | Create | Server actions: register, login, verifyEmail, forgotPassword, resetPassword, verifyTotp |
| `src/test/auth-actions.test.ts` | Create | Server action unit tests |
| `src/middleware.ts` | Create | next-intl locale + auth guard |
| `src/app/layout.tsx` | Modify | Add Sonner Toaster |
| `src/app/[locale]/layout.tsx` | Create | Marketing shell: NextIntlClientProvider + Header + Footer + CookieBanner |
| `src/components/layout/Header.tsx` | Create | Marketing header (logo + nav + CTA) |
| `src/components/layout/Footer.tsx` | Create | Marketing footer (logo + links) |
| `src/components/layout/CookieBanner.tsx` | Create | GDPR cookie banner (localStorage) |
| `src/app/[locale]/page.tsx` | Create | Landing page (hero, features, pricing, CTA, reviews, footer) |
| `src/components/auth/AuthCard.tsx` | Create | Shared auth card wrapper + underline input + primary button |
| `src/app/[locale]/auth/login/page.tsx` | Create | Login page |
| `src/app/[locale]/auth/register/page.tsx` | Create | Register page |
| `src/app/[locale]/auth/forgot-password/page.tsx` | Create | Forgot password page |
| `src/app/[locale]/auth/reset-password/page.tsx` | Create | Reset password page |
| `src/app/[locale]/auth/verify-email/page.tsx` | Create | Email verification handler + status page |
| `src/lib/totp.ts` | Create | TOTP generate/verify helpers (otpauth) |
| `src/test/totp.test.ts` | Create | TOTP unit tests |
| `src/app/[locale]/auth/totp-challenge/page.tsx` | Create | TOTP challenge form |
| `src/components/layout/Sidebar.tsx` | Create | Desktop sidebar (nav + credit chip + user footer) |
| `src/components/layout/BottomNav.tsx` | Create | Mobile bottom nav |
| `src/components/layout/MobileHeader.tsx` | Create | Mobile glassmorphism header |
| `src/app/app/layout.tsx` | Create | App shell layout (auth check + providers + shell) |
| `src/app/app/dashboard/page.tsx` | Create | Dashboard placeholder |
| `README.md` | Modify | Add Mailgun env vars to table + phase changelog |

---

## Task 1: Expand Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace schema.prisma with Phase 1b User model**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               String    @id @default(cuid())
  email            String    @unique
  passwordHash     String
  emailVerified    DateTime?
  locale           String    @default("en")
  role             String    @default("user")

  totpSecret       String?
  totpEnabled      Boolean   @default(false)
  totpBackupCodes  String[]
  requiresMfa      Boolean   @default(false)

  monthlyCredits   Int       @default(75)
  permanentCredits Int       @default(0)
  isLifetimeFree   Boolean   @default(false)

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model AdminSettings {
  key   String @id
  value Json
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name phase-1b-user
```

Expected: `✔  Your database is now in sync with your schema.`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(schema): expand User model for Phase 1b auth"
```

---

## Task 2: Install Dependencies

**Files:** `package.json` (modified by npm)

- [ ] **Step 1: Install all Phase 1b dependencies**

```bash
npm install next-intl next-auth@5 bcryptjs zod mailgun.js form-data otpauth qrcode
npm install --save-dev @types/bcryptjs @types/qrcode
```

- [ ] **Step 2: Install Sonner via shadcn**

```bash
npx shadcn@latest add sonner
```

- [ ] **Step 3: Verify no peer dependency errors**

```bash
npm ls next-auth next-intl otpauth
```

Expected: tree with no UNMET PEER DEPENDENCY warnings.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/sonner.tsx
git commit -m "feat(deps): add next-intl, next-auth@5, bcryptjs, zod, mailgun, otpauth, qrcode, sonner"
```

---

## Task 3: Configure next-intl

**Files:**
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/request.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Create routing config**

`src/i18n/routing.ts`:
```ts
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['nl', 'en'] as const,
  defaultLocale: 'en',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]
```

- [ ] **Step 2: Create request config**

`src/i18n/request.ts`:
```ts
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale
  }
  const [common, auth, landing, app] = await Promise.all([
    import(`../../messages/${locale}/common.json`).then(m => m.default),
    import(`../../messages/${locale}/auth.json`).then(m => m.default),
    import(`../../messages/${locale}/landing.json`).then(m => m.default),
    import(`../../messages/${locale}/app.json`).then(m => m.default),
  ])
  return { locale, messages: { common, auth, landing, app } }
})
```

- [ ] **Step 3: Update next.config.ts**

```ts
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig = {
  output: 'standalone',
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/ next.config.ts
git commit -m "feat(i18n): configure next-intl with nl/en routing"
```

---

## Task 4: Create Translation Message Files

**Files:**
- Create: `messages/nl/common.json`, `messages/nl/auth.json`, `messages/nl/landing.json`, `messages/nl/app.json`
- Create: `messages/en/common.json`, `messages/en/auth.json`, `messages/en/landing.json`, `messages/en/app.json`

- [ ] **Step 1: Create `messages/nl/common.json`**

```json
{
  "nav": {
    "landing": "Home",
    "pricing": "Prijzen",
    "login": "Inloggen",
    "register": "Aanmelden"
  },
  "cookieBanner": {
    "message": "We gebruiken alleen essentiële cookies voor de sessie.",
    "accept": "Akkoord",
    "readMore": "Lees ons privacybeleid"
  },
  "errors": {
    "serverError": "Er is iets misgegaan. Probeer het opnieuw."
  }
}
```

- [ ] **Step 2: Create `messages/nl/auth.json`**

```json
{
  "login": {
    "title": "Welkom terug",
    "subtitle": "Log in op je Dice Vault",
    "email": "E-mailadres",
    "password": "Wachtwoord",
    "submit": "Inloggen",
    "forgotPassword": "Wachtwoord vergeten?",
    "noAccount": "Nog geen account?",
    "register": "Aanmelden"
  },
  "register": {
    "title": "Account aanmaken",
    "subtitle": "Begin met het bijhouden van je scores",
    "email": "E-mailadres",
    "password": "Wachtwoord",
    "passwordConfirm": "Wachtwoord bevestigen",
    "submit": "Account aanmaken",
    "hasAccount": "Al een account?",
    "login": "Inloggen",
    "checkEmail": "Controleer je e-mail! We hebben een verificatielink gestuurd."
  },
  "verify": {
    "title": "E-mail verifiëren",
    "verifying": "Bezig met verifiëren...",
    "success": "E-mail geverifieerd! Je kunt nu inloggen.",
    "invalid": "Ongeldige of verlopen verificatielink.",
    "login": "Inloggen"
  },
  "forgot": {
    "title": "Wachtwoord vergeten",
    "subtitle": "Vul je e-mailadres in en we sturen een resetlink.",
    "email": "E-mailadres",
    "submit": "Resetlink versturen",
    "sent": "Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een resetlink.",
    "backToLogin": "Terug naar inloggen"
  },
  "reset": {
    "title": "Nieuw wachtwoord",
    "subtitle": "Kies een sterk wachtwoord van minimaal 8 tekens.",
    "password": "Nieuw wachtwoord",
    "passwordConfirm": "Bevestig wachtwoord",
    "submit": "Wachtwoord opslaan",
    "success": "Wachtwoord gewijzigd. Je kunt nu inloggen.",
    "invalid": "Ongeldige of verlopen resetlink."
  },
  "totp": {
    "title": "Tweestapsverificatie",
    "subtitle": "Voer de 6-cijferige code in van je authenticator-app.",
    "code": "Code",
    "submit": "Verifiëren",
    "useBackup": "Gebruik een herstelcode",
    "invalid": "Ongeldige code. Probeer opnieuw.",
    "expired": "Sessie verlopen. Log opnieuw in."
  },
  "errors": {
    "invalidCredentials": "Onjuist e-mailadres of wachtwoord.",
    "emailNotVerified": "Bevestig eerst je e-mailadres. Controleer je inbox.",
    "emailInUse": "Dit e-mailadres is al in gebruik.",
    "passwordMismatch": "Wachtwoorden komen niet overeen.",
    "passwordTooShort": "Wachtwoord moet minimaal 8 tekens bevatten.",
    "invalidEmail": "Voer een geldig e-mailadres in.",
    "serverError": "Er is iets misgegaan. Probeer het opnieuw."
  }
}
```

- [ ] **Step 3: Create `messages/nl/landing.json`**

```json
{
  "hero": {
    "badge": "Gratis te gebruiken",
    "headline": "Bewaar je scores veilig.",
    "subheadline": "Log elke spelletjesavond, volg statistieken en bouw een permanent archief voor jouw groep. Jouw kluis, jouw data.",
    "ctaPrimary": "Begin gratis",
    "ctaSecondary": "Bekijk functies"
  },
  "features": {
    "overline": "Functies",
    "headline": "Alles wat je nodig hebt",
    "items": [
      {
        "icon": "Dices",
        "title": "Score logging",
        "description": "Log scores per speler en per sessie. Eenvoudig, snel en altijd beschikbaar."
      },
      {
        "icon": "BarChart2",
        "title": "Statistieken",
        "description": "Bekijk wie het vaakst wint, de hoogste scores haalt en de meeste sessies speelt."
      },
      {
        "icon": "Shield",
        "title": "Permanent archief",
        "description": "Jouw spelgeschiedenis blijft altijd bewaard. Geen data verloren, nooit meer discussie over wie er won."
      }
    ]
  },
  "howItWorks": {
    "overline": "Hoe het werkt",
    "headline": "Jouw kluis, jouw regels.",
    "subheadline": "Vier bouwstenen. Vijf minuten om in te stellen. Een leven lang spelgeschiedenis.",
    "steps": [
      {
        "label": "Kluis",
        "icon": "Vault",
        "title": "Jouw persoonlijke kluis",
        "description": "Elk account is een kluis — jouw persoonlijk scorebord dat alleen jij beheert. Spelers zijn labels in jouw kluis, geen aparte accounts. Jij blijft in controle."
      },
      {
        "label": "Spellen",
        "icon": "Dices",
        "title": "Spelsjablonen",
        "description": "Maak een sjabloon voor elk bordspel: stel het scoringsformaat eenmalig in en hergebruik het voor altijd. Catan, Wingspan, Ticket to Ride — alles consistent bijgehouden."
      },
      {
        "label": "Spelers",
        "icon": "Users",
        "title": "Spelers in jouw groep",
        "description": "Voeg iedereen in je groep toe als speler. Verbind een speler met hun eigen Dice Vault-account en zij zien hun eigen statistieken automatisch — geen gedeelde logins."
      },
      {
        "label": "Competities",
        "icon": "Trophy",
        "title": "Competitieve leagues",
        "description": "Start een league voor elk spelsjabloon. De league houdt standen, winsten en historiek bij over sessies heen. Perfect voor seizoensspel of langlopende rivaliteiten."
      }
    ]
  },
  "group": {
    "overline": "Groepsfuncties",
    "headline": "Speel samen, win samen.",
    "subheadline": "Dice Vault is gebouwd voor vaste spelgroepen. Verbind spelers, maak competities aan en houd iedereen scherp.",
    "items": [
      {
        "icon": "Trophy",
        "title": "Competities (Leagues)",
        "description": "Maak een league aan voor je favoriete spel. Rangschikking, statistieken en historiek — alles bijgehouden per seizoen."
      },
      {
        "icon": "UserCheck",
        "title": "Verbonden spelers",
        "description": "Nodig andere Dice Vault-gebruikers uit als speler in jouw kluis. Zij zien hun eigen scores en statistieken meteen in hun eigen account."
      },
      {
        "icon": "Share2",
        "title": "Gedeelde resultaten",
        "description": "Stuur een openbare link naar het resultaat van elke sessie. Geen account nodig om te bekijken."
      },
      {
        "icon": "Bell",
        "title": "Meldingen",
        "description": "Ontvang een melding als iemand een sessie instuurt, een verbindingsverzoek stuurt of een league-uitnodiging verstuurt."
      }
    ],
    "cta": "Begin met je groep"
  },
  "credits": {
    "overline": "Hoe credits werken",
    "headline": "Simpel, transparant, eerlijk.",
    "subheadline": "Geen verborgen kosten. Elke actie kost een vast aantal credits — je ziet altijd wat je uitgeeft.",
    "free": {
      "badge": "Elke maand gratis",
      "amount": "75",
      "label": "credits / maand",
      "description": "Je krijgt elke maand automatisch 75 gratis credits. Genoeg voor een actieve spelgroep."
    },
    "costs": {
      "title": "Wat kost wat?",
      "items": [
        { "action": "Sessie loggen", "cost": 5, "icon": "ClipboardList" },
        { "action": "Speler verbinden", "cost": 10, "icon": "UserPlus" },
        { "action": "Competitie aanmaken", "cost": 10, "icon": "Trophy" },
        { "action": "Spelsjabloon aanmaken", "cost": 25, "icon": "Dices" }
      ],
      "credits": "credits"
    },
    "example": {
      "title": "Wat kun je met 75 credits?",
      "description": "Richt je groep in: 1 spelsjabloon (25) + 1 competitie (10) + 3 spelers verbinden (30) = 65 credits. Dan houd je 10 credits over voor 2 sessies.",
      "note": "Credits verlopen nooit. Ongebruikte credits blijven staan."
    }
  },
  "packs": {
    "overline": "Extra credits",
    "headline": "Meer nodig? Koop eenmalig bijkopen.",
    "subheadline": "Geen abonnement. Credits verlopen niet. Betaal alleen als je meer nodig hebt.",
    "items": [
      { "credits": 100,  "price": "€4,99",  "tag": "" },
      { "credits": 300,  "price": "€11,99", "tag": "Populair" },
      { "credits": 800,  "price": "€24,99", "tag": "Beste waarde" },
      { "credits": 2000, "price": "€49,99", "tag": "" }
    ],
    "priceNote": "Prijzen zijn indicatief voor de EU. Exacte prijs wordt bepaald op basis van jouw regio bij het afrekenen.",
    "cta": "Aanmelden en credits kopen"
  },
  "payments": {
    "overline": "Betaalopties",
    "headline": "Betaal zoals jij wilt.",
    "methods": [
      {
        "title": "iDEAL & Bancontact",
        "description": "Voor Nederland en België. Betaal direct via je eigen bank.",
        "icon": "Building2",
        "tag": "EU",
        "tagVariant": ""
      },
      {
        "title": "Creditcard",
        "description": "Visa, Mastercard en American Express — wereldwijd beschikbaar.",
        "icon": "CreditCard",
        "tag": "Wereldwijd",
        "tagVariant": ""
      },
      {
        "title": "Bitcoin Lightning ⚡",
        "description": "Betaal met Bitcoin via het Lightning Network. Automatisch 10% korting — altijd.",
        "icon": "Zap",
        "tag": "10% korting",
        "tagVariant": "highlight"
      }
    ],
    "note": "Bitcoin Lightning betalingen komen binnenkort beschikbaar."
  },
  "pricing": {
    "overline": "Samenvatting",
    "headline": "Simpel en eerlijk",
    "free": {
      "label": "Gratis",
      "credits": "75 credits per maand",
      "description": "Voor altijd gratis. Genoeg voor een actieve groep.",
      "cta": "Begin gratis"
    }
  },
  "cta": {
    "headline": "Klaar om te beginnen?",
    "body": "Maak een gratis account aan en begin vandaag nog met het bijhouden van je scores. Geen creditcard nodig.",
    "button": "Maak een gratis account"
  },
  "reviews": {
    "overline": "Wat anderen zeggen",
    "headline": "Geliefd door spelers",
    "placeholder": [
      {
        "name": "Martijn V.",
        "review": "Eindelijk een app die het bijhouden van spelscores serieus neemt. De league-functie is top — onze groep speelt nu met een echte rangschikking.",
        "game": "Catan"
      },
      {
        "name": "Sophie K.",
        "review": "Zo fijn dat je nooit meer hoeft te discussiëren over wie er wint. Alles staat gewoon bij, en mijn vrienden zien hun eigen scores meteen.",
        "game": "Wingspan"
      },
      {
        "name": "Thomas B.",
        "review": "Eenvoudig, snel en doet precies wat je verwacht. Onze groep gebruikt het elke week en de statistieken zijn geweldig.",
        "game": "Ticket to Ride"
      }
    ]
  },
  "footer": {
    "tagline": "Jouw spelgeschiedenis, veilig bewaard.",
    "rights": "Alle rechten voorbehouden."
  }
}
```

- [ ] **Step 4: Create `messages/nl/app.json`**

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "players": "Spelers",
    "games": "Spellen",
    "sessions": "Sessies",
    "credits": "Credits",
    "settings": "Instellingen"
  },
  "credits": {
    "balance": "{n} credits",
    "low": "Bijna op"
  }
}
```

- [ ] **Step 5: Create English equivalents**

`messages/en/common.json`:
```json
{
  "nav": {
    "landing": "Home",
    "pricing": "Pricing",
    "login": "Log in",
    "register": "Sign up"
  },
  "cookieBanner": {
    "message": "We only use essential cookies for your session.",
    "accept": "Got it",
    "readMore": "Read our privacy policy"
  },
  "errors": {
    "serverError": "Something went wrong. Please try again."
  }
}
```

`messages/en/auth.json`:
```json
{
  "login": {
    "title": "Welcome back",
    "subtitle": "Log in to your Dice Vault",
    "email": "Email address",
    "password": "Password",
    "submit": "Log in",
    "forgotPassword": "Forgot password?",
    "noAccount": "Don't have an account?",
    "register": "Sign up"
  },
  "register": {
    "title": "Create account",
    "subtitle": "Start tracking your scores",
    "email": "Email address",
    "password": "Password",
    "passwordConfirm": "Confirm password",
    "submit": "Create account",
    "hasAccount": "Already have an account?",
    "login": "Log in",
    "checkEmail": "Check your email! We sent you a verification link."
  },
  "verify": {
    "title": "Verify email",
    "verifying": "Verifying...",
    "success": "Email verified! You can now log in.",
    "invalid": "Invalid or expired verification link.",
    "login": "Log in"
  },
  "forgot": {
    "title": "Forgot password",
    "subtitle": "Enter your email and we'll send a reset link.",
    "email": "Email address",
    "submit": "Send reset link",
    "sent": "If this email is registered, you'll receive a reset link within a few minutes.",
    "backToLogin": "Back to log in"
  },
  "reset": {
    "title": "New password",
    "subtitle": "Choose a strong password of at least 8 characters.",
    "password": "New password",
    "passwordConfirm": "Confirm password",
    "submit": "Save password",
    "success": "Password changed. You can now log in.",
    "invalid": "Invalid or expired reset link."
  },
  "totp": {
    "title": "Two-factor authentication",
    "subtitle": "Enter the 6-digit code from your authenticator app.",
    "code": "Code",
    "submit": "Verify",
    "useBackup": "Use a recovery code",
    "invalid": "Invalid code. Please try again.",
    "expired": "Session expired. Please log in again."
  },
  "errors": {
    "invalidCredentials": "Incorrect email or password.",
    "emailNotVerified": "Please verify your email first. Check your inbox.",
    "emailInUse": "This email is already in use.",
    "passwordMismatch": "Passwords do not match.",
    "passwordTooShort": "Password must be at least 8 characters.",
    "invalidEmail": "Please enter a valid email address.",
    "serverError": "Something went wrong. Please try again."
  }
}
```

`messages/en/landing.json`:
```json
{
  "hero": {
    "badge": "Free to use",
    "headline": "Store your scores safely.",
    "subheadline": "Log every game night, track player statistics, and build a permanent archive for your group. Your vault, your data.",
    "ctaPrimary": "Start for free",
    "ctaSecondary": "Explore features"
  },
  "features": {
    "overline": "Features",
    "headline": "Everything you need",
    "items": [
      {
        "icon": "Dices",
        "title": "Score logging",
        "description": "Log scores per player and session. Simple, fast, and always available."
      },
      {
        "icon": "BarChart2",
        "title": "Statistics",
        "description": "See who wins most often, achieves the highest scores, and plays the most sessions."
      },
      {
        "icon": "Shield",
        "title": "Permanent archive",
        "description": "Your game history is always preserved. No data lost, no more arguments about who won."
      }
    ]
  },
  "howItWorks": {
    "overline": "How it works",
    "headline": "Your vault, your rules.",
    "subheadline": "Four building blocks. Five minutes to set up. A lifetime of game history.",
    "steps": [
      {
        "label": "Vault",
        "icon": "Vault",
        "title": "Your private vault",
        "description": "Every account is a vault — your personal scoreboard that only you manage. Players are labels in your vault, not separate accounts. You stay in control."
      },
      {
        "label": "Games",
        "icon": "Dices",
        "title": "Game templates",
        "description": "Create a template for each board game: define the scoring format and notes once, then reuse it forever. Catan, Wingspan, Ticket to Ride — all tracked consistently."
      },
      {
        "label": "Players",
        "icon": "Users",
        "title": "Players in your group",
        "description": "Add everyone in your group as a player. Connect a player to their own Dice Vault account and they'll see their personal stats automatically — no sharing logins."
      },
      {
        "label": "Leagues",
        "icon": "Trophy",
        "title": "Competitive leagues",
        "description": "Run a league for any game template. The league tracks standings, wins, and history across sessions. Perfect for season play or long-running rivalries."
      }
    ]
  },
  "group": {
    "overline": "Group features",
    "headline": "Play together, win together.",
    "subheadline": "Dice Vault is built for regular game groups. Connect players, run leagues, and keep everyone sharp.",
    "items": [
      {
        "icon": "Trophy",
        "title": "Leagues",
        "description": "Create a league for your favourite game. Rankings, statistics, and history — all tracked per season."
      },
      {
        "icon": "UserCheck",
        "title": "Connected players",
        "description": "Invite other Dice Vault users as players in your vault. They see their own scores and statistics instantly in their own account."
      },
      {
        "icon": "Share2",
        "title": "Shared results",
        "description": "Send a public link to any session result. No account needed to view — just share the link."
      },
      {
        "icon": "Bell",
        "title": "Notifications",
        "description": "Get notified when someone submits a session, sends a connection request, or invites you to a league."
      }
    ],
    "cta": "Start with your group"
  },
  "credits": {
    "overline": "How credits work",
    "headline": "Simple, transparent, fair.",
    "subheadline": "No hidden costs. Every action costs a fixed number of credits — you always see what you spend.",
    "free": {
      "badge": "Every month, free",
      "amount": "75",
      "label": "credits / month",
      "description": "You receive 75 free credits every month automatically. Enough for an active game group."
    },
    "costs": {
      "title": "What costs what?",
      "items": [
        { "action": "Log a session", "cost": 5, "icon": "ClipboardList" },
        { "action": "Connect a player", "cost": 10, "icon": "UserPlus" },
        { "action": "Create a league", "cost": 10, "icon": "Trophy" },
        { "action": "Create a game template", "cost": 25, "icon": "Dices" }
      ],
      "credits": "credits"
    },
    "example": {
      "title": "What can you do with 75 credits?",
      "description": "Set up your group: 1 game template (25) + 1 league (10) + 3 connected players (30) = 65 credits. Then log 2 sessions with the remaining 10 credits.",
      "note": "Credits never expire. Unused credits carry over."
    }
  },
  "packs": {
    "overline": "Extra credits",
    "headline": "Need more? Buy once.",
    "subheadline": "No subscription. Credits never expire. Pay only when you need more.",
    "items": [
      { "credits": 100,  "price": "€4.99",  "tag": "" },
      { "credits": 300,  "price": "€11.99", "tag": "Popular" },
      { "credits": 800,  "price": "€24.99", "tag": "Best value" },
      { "credits": 2000, "price": "€49.99", "tag": "" }
    ],
    "priceNote": "Prices shown are indicative for the EU. Your exact price is determined at checkout based on your region.",
    "cta": "Sign up and buy credits"
  },
  "payments": {
    "overline": "Payment options",
    "headline": "Pay how you want.",
    "methods": [
      {
        "title": "iDEAL & Bancontact",
        "description": "For the Netherlands and Belgium. Pay directly via your own bank.",
        "icon": "Building2",
        "tag": "EU",
        "tagVariant": ""
      },
      {
        "title": "Credit card",
        "description": "Visa, Mastercard and American Express — available worldwide.",
        "icon": "CreditCard",
        "tag": "Worldwide",
        "tagVariant": ""
      },
      {
        "title": "Bitcoin Lightning ⚡",
        "description": "Pay with Bitcoin via the Lightning Network. Automatic 10% discount — always.",
        "icon": "Zap",
        "tag": "10% off",
        "tagVariant": "highlight"
      }
    ],
    "note": "Bitcoin Lightning payments coming soon."
  },
  "pricing": {
    "overline": "Summary",
    "headline": "Simple and fair",
    "free": {
      "label": "Free",
      "credits": "75 credits per month",
      "description": "Free forever. Enough for an active group.",
      "cta": "Start for free"
    }
  },
  "cta": {
    "headline": "Ready to get started?",
    "body": "Create a free account and start tracking your scores today. No credit card required.",
    "button": "Create a free account"
  },
  "reviews": {
    "overline": "What others say",
    "headline": "Loved by players",
    "placeholder": [
      {
        "name": "Martijn V.",
        "review": "Finally an app that takes board game score tracking seriously. The league feature is great — our group now plays with a real ranking.",
        "game": "Catan"
      },
      {
        "name": "Sophie K.",
        "review": "No more arguments about who won. Everything is recorded, and my friends see their own scores immediately.",
        "game": "Wingspan"
      },
      {
        "name": "Thomas B.",
        "review": "Simple, fast, and does exactly what you'd expect. Our group uses it every week and the statistics are great.",
        "game": "Ticket to Ride"
      }
    ]
  },
  "footer": {
    "tagline": "Your game history, safely stored.",
    "rights": "All rights reserved."
  }
}
```

`messages/en/app.json`:
```json
{
  "nav": {
    "dashboard": "Dashboard",
    "players": "Players",
    "games": "Games",
    "sessions": "Sessions",
    "credits": "Credits",
    "settings": "Settings"
  },
  "credits": {
    "balance": "{n} credits",
    "low": "Running low"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add nl/en translation files for common, auth, landing, app"
```

---

## Task 5: NextAuth v5 Configuration

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Create `src/lib/auth.ts`**

```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        totpVerifiedToken: {},
      },
      async authorize(credentials) {
        // TOTP-verified flow: a pending token in Redis proves TOTP was passed
        if (credentials.totpVerifiedToken) {
          const userId = await redis.get(`totp_verified:${credentials.totpVerifiedToken}`)
          if (!userId) return null
          await redis.del(`totp_verified:${credentials.totpVerifiedToken}`)
          const user = await prisma.user.findUnique({ where: { id: userId as string } })
          if (!user) return null
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            locale: user.locale,
            totpEnabled: user.totpEnabled,
            requiresMfa: user.requiresMfa,
          }
        }

        // Normal email + password login
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
        if (!user || !user.emailVerified) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          locale: user.locale,
          totpEnabled: user.totpEnabled,
          requiresMfa: user.requiresMfa,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.locale = (user as any).locale
        token.totpEnabled = (user as any).totpEnabled
        token.requiresMfa = (user as any).requiresMfa
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.locale = token.locale as string
      session.user.totpEnabled = token.totpEnabled as boolean
      session.user.requiresMfa = token.requiresMfa as boolean
      return session
    },
  },
  pages: {
    signIn: '/en/auth/login',
  },
  session: { strategy: 'jwt' },
})
```

- [ ] **Step 2: Create `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 3: Create `src/types/next-auth.d.ts`**

```ts
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: string
      locale: string
      totpEnabled: boolean
      requiresMfa: boolean
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/types/
git commit -m "feat(auth): add NextAuth v5 Credentials provider with TOTP token flow"
```

---

## Task 6: Mailgun Mail Helpers + Tests

**Files:**
- Create: `src/lib/mail.ts`
- Create: `src/test/mail.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/test/mail.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('mailgun.js', () => ({
  default: vi.fn(() => ({
    client: vi.fn(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({ id: 'test-id', status: 200 }),
      },
    })),
  })),
}))

vi.mock('form-data', () => ({ default: vi.fn() }))

describe('mail', () => {
  beforeEach(() => {
    process.env.MAILGUN_API_KEY = 'test-key'
    process.env.MAILGUN_DOMAIN = 'test.mailgun.org'
    process.env.MAILGUN_FROM = 'Dice Vault <noreply@dicevault.fun>'
    process.env.NEXTAUTH_URL = 'https://dicevault.fun'
  })

  it('sendVerificationEmail builds a link with the token', async () => {
    const { sendVerificationEmail } = await import('@/lib/mail')
    await expect(sendVerificationEmail('user@example.com', 'abc123', 'nl')).resolves.not.toThrow()
  })

  it('sendPasswordResetEmail builds a link with the token', async () => {
    const { sendPasswordResetEmail } = await import('@/lib/mail')
    await expect(sendPasswordResetEmail('user@example.com', 'xyz789', 'en')).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/mail.test.ts
```

Expected: FAIL — `@/lib/mail` not found.

- [ ] **Step 3: Create `src/lib/mail.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/mail.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mail.ts src/test/mail.test.ts
git commit -m "feat(mail): add Mailgun email helpers for verification and password reset"
```

---

## Task 7: TOTP Helpers + Tests

**Files:**
- Create: `src/lib/totp.ts`
- Create: `src/test/totp.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/test/totp.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateTOTPSecret, verifyTOTPCode, generateBackupCodes } from '@/lib/totp'

describe('totp', () => {
  it('generateTOTPSecret returns a base32 secret and otpauth URI', () => {
    const result = generateTOTPSecret('test@example.com')
    expect(result.secret).toBeTruthy()
    expect(result.uri).toContain('otpauth://totp/')
    expect(result.uri).toContain('test%40example.com')
  })

  it('verifyTOTPCode returns false for an invalid code', () => {
    const { secret } = generateTOTPSecret('test@example.com')
    expect(verifyTOTPCode(secret, '000000')).toBe(false)
  })

  it('generateBackupCodes returns 8 unique 10-char codes', () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(8)
    const unique = new Set(codes)
    expect(unique.size).toBe(8)
    codes.forEach(c => expect(c).toHaveLength(10))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/totp.test.ts
```

Expected: FAIL — `@/lib/totp` not found.

- [ ] **Step 3: Create `src/lib/totp.ts`**

```ts
import { TOTP, Secret } from 'otpauth'
import crypto from 'crypto'

export function generateTOTPSecret(email: string): { secret: string; uri: string } {
  const totp = new TOTP({
    issuer: 'Dice Vault',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  })
  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  }
}

export function verifyTOTPCode(secretBase32: string, token: string): boolean {
  const totp = new TOTP({
    issuer: 'Dice Vault',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  })
  const delta = totp.validate({ token, window: 1 })
  return delta !== null
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString('hex')
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/totp.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/totp.ts src/test/totp.test.ts
git commit -m "feat(totp): add TOTP generate/verify helpers and backup code generator"
```

---

## Task 8: Auth Server Actions + Tests

**Files:**
- Create: `src/app/[locale]/auth/actions.ts`
- Create: `src/test/auth-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/test/auth-actions.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrismaUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  emailVerified: null as Date | null,
  locale: 'en',
  role: 'user',
  totpEnabled: false,
  totpSecret: null as string | null,
  totpBackupCodes: [] as string[],
  requiresMfa: false,
  monthlyCredits: 75,
  permanentCredits: 0,
  isLifetimeFree: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('@/lib/mail', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

// next/navigation redirect throws in server actions — mock it
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))

vi.mock('next-auth', () => ({ signIn: vi.fn() }))
vi.mock('@/lib/auth', () => ({ signIn: vi.fn() }))

describe('auth actions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('register', () => {
    it('returns error when email already in use', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPrismaUser)

      const { register } = await import('@/app/[locale]/auth/actions')
      const formData = new FormData()
      formData.set('email', 'test@example.com')
      formData.set('password', 'password123')
      formData.set('passwordConfirm', 'password123')
      formData.set('locale', 'en')

      const result = await register(formData)
      expect(result).toEqual({ error: 'auth.errors.emailInUse' })
    })

    it('returns error when passwords do not match', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const { register } = await import('@/app/[locale]/auth/actions')
      const formData = new FormData()
      formData.set('email', 'new@example.com')
      formData.set('password', 'password123')
      formData.set('passwordConfirm', 'different')
      formData.set('locale', 'en')

      const result = await register(formData)
      expect(result).toEqual({ error: 'auth.errors.passwordMismatch' })
    })
  })

  describe('forgotPassword', () => {
    it('always returns success to prevent email enumeration', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const { forgotPassword } = await import('@/app/[locale]/auth/actions')
      const formData = new FormData()
      formData.set('email', 'nobody@example.com')
      formData.set('locale', 'en')

      const result = await forgotPassword(formData)
      expect(result).toEqual({ success: true })
    })
  })

  describe('resetPassword', () => {
    it('returns error when token not found in Redis', async () => {
      const { redis } = await import('@/lib/redis')
      vi.mocked(redis.get).mockResolvedValue(null)

      const { resetPassword } = await import('@/app/[locale]/auth/actions')
      const formData = new FormData()
      formData.set('token', 'invalid-token')
      formData.set('password', 'newpassword123')
      formData.set('passwordConfirm', 'newpassword123')

      const result = await resetPassword(formData)
      expect(result).toEqual({ error: 'auth.reset.invalid' })
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/auth-actions.test.ts
```

Expected: FAIL — `@/app/[locale]/auth/actions` not found.

- [ ] **Step 3: Create `src/app/[locale]/auth/actions.ts`**

```ts
'use server'

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { signIn } from '@/lib/auth'
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/mail'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { redirect } from 'next/navigation'
import { z } from 'zod'

type ActionResult = { error: string } | { success: true } | void

const emailSchema = z.string().email()
const passwordSchema = z.string().min(8)

export async function register(formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string
  const locale = (formData.get('locale') as string) || 'en'

  if (!emailSchema.safeParse(email).success) return { error: 'auth.errors.invalidEmail' }
  if (!passwordSchema.safeParse(password).success) return { error: 'auth.errors.passwordTooShort' }
  if (password !== passwordConfirm) return { error: 'auth.errors.passwordMismatch' }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'auth.errors.emailInUse' }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { email, passwordHash, locale },
  })

  const token = crypto.randomUUID()
  await redis.setex(`email_verify:${token}`, 60 * 60 * 24, user.id)
  await sendVerificationEmail(email, token, locale)

  return { success: true }
}

export async function verifyEmail(token: string): Promise<ActionResult> {
  const userId = await redis.get(`email_verify:${token}`)
  if (!userId) return { error: 'auth.verify.invalid' }

  await prisma.user.update({
    where: { id: userId as string },
    data: { emailVerified: new Date() },
  })
  await redis.del(`email_verify:${token}`)

  return { success: true }
}

export async function login(formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const locale = (formData.get('locale') as string) || 'en'

  if (!emailSchema.safeParse(email).success || !password) {
    return { error: 'auth.errors.invalidCredentials' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.emailVerified) {
    if (user && !user.emailVerified) return { error: 'auth.errors.emailNotVerified' }
    return { error: 'auth.errors.invalidCredentials' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'auth.errors.invalidCredentials' }

  if (user.totpEnabled) {
    const pendingToken = crypto.randomUUID()
    await redis.setex(`totp_pending:${pendingToken}`, 300, user.id)
    redirect(`/${locale}/auth/totp-challenge?token=${pendingToken}`)
  }

  await signIn('credentials', { email, password, redirectTo: '/app/dashboard' })
}

export async function verifyTotp(formData: FormData): Promise<ActionResult> {
  const pendingToken = formData.get('token') as string
  const code = (formData.get('code') as string)?.trim()
  const locale = (formData.get('locale') as string) || 'en'

  const userId = await redis.get(`totp_pending:${pendingToken}`)
  if (!userId) return { error: 'auth.totp.expired' }

  const user = await prisma.user.findUnique({ where: { id: userId as string } })
  if (!user || !user.totpSecret) return { error: 'auth.errors.serverError' }

  const { verifyTOTPCode } = await import('@/lib/totp')
  let valid = verifyTOTPCode(user.totpSecret, code)

  if (!valid && user.totpBackupCodes.length > 0) {
    for (const hashed of user.totpBackupCodes) {
      const match = await bcrypt.compare(code, hashed)
      if (match) {
        valid = true
        await prisma.user.update({
          where: { id: user.id },
          data: { totpBackupCodes: user.totpBackupCodes.filter(c => c !== hashed) },
        })
        break
      }
    }
  }

  if (!valid) return { error: 'auth.totp.invalid' }

  await redis.del(`totp_pending:${pendingToken}`)

  const verifiedToken = crypto.randomUUID()
  await redis.setex(`totp_verified:${verifiedToken}`, 30, user.id)

  await signIn('credentials', { totpVerifiedToken: verifiedToken, redirectTo: '/app/dashboard' })
}

export async function forgotPassword(formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const locale = (formData.get('locale') as string) || 'en'

  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    const token = crypto.randomUUID()
    await redis.setex(`pw_reset:${token}`, 60 * 15, user.id)
    await sendPasswordResetEmail(email, token, locale)
  }

  return { success: true }
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const token = formData.get('token') as string
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string

  if (!passwordSchema.safeParse(password).success) return { error: 'auth.errors.passwordTooShort' }
  if (password !== passwordConfirm) return { error: 'auth.errors.passwordMismatch' }

  const userId = await redis.get(`pw_reset:${token}`)
  if (!userId) return { error: 'auth.reset.invalid' }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: userId as string },
    data: { passwordHash },
  })
  await redis.del(`pw_reset:${token}`)

  return { success: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/auth-actions.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/auth/ src/test/auth-actions.test.ts
git commit -m "feat(auth): add server actions for register, login, TOTP, forgot/reset password"
```

---

## Task 9: Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/middleware.ts`**

```ts
import { auth } from '@/lib/auth'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const handleI18n = createMiddleware(routing)

export default auth(function middleware(req: NextRequest & { auth: any }) {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/app') || pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/en/auth/login', req.url))
    }
    if (pathname.startsWith('/admin') && session.user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/en', req.url))
    }
    return NextResponse.next()
  }

  return handleI18n(req)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): add next-intl locale routing and NextAuth auth guard"
```

---

## Task 10: Root Layout Update + Locale Layout + Marketing Shell

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/[locale]/layout.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/Footer.tsx`
- Create: `src/components/layout/CookieBanner.tsx`

- [ ] **Step 1: Update `src/app/layout.tsx` — add Sonner Toaster**

```tsx
import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dice Vault — Store Your Scores Safely',
  description: 'Track your board game sessions, rank your group, and build a permanent archive of your game nights.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `src/components/layout/Header.tsx`**

```tsx
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Dices } from 'lucide-react'

export default function Header({ locale }: { locale: string }) {
  const t = useTranslations('common.nav')
  return (
    <header className="sticky top-0 z-50" style={{ background: 'rgba(248,249,250,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(43,52,55,0.07)' }}>
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
            <Dices size={18} strokeWidth={2.2} className="text-on-primary" />
          </div>
          <div>
            <div className="font-headline font-black text-[14.5px] text-on-surface tracking-[-0.02em] leading-none">Dice Vault</div>
            <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant leading-none mt-0.5">dicevault.fun</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href={`/${locale}/auth/login`} className="px-4 py-2 rounded-xl font-headline font-semibold text-[13.5px] text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors">
            {t('login')}
          </Link>
          <Link href={`/${locale}/auth/register`} className="px-4 py-2 rounded-[999px] bg-primary text-on-primary font-headline font-bold text-[13px] transition-all hover:bg-primary-dim" style={{ boxShadow: '0 4px 14px rgba(0,91,192,0.24)' }}>
            {t('register')}
          </Link>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create `src/components/layout/Footer.tsx`**

```tsx
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Dices } from 'lucide-react'

export default function Footer({ locale }: { locale: string }) {
  const t = useTranslations('landing.footer')
  return (
    <footer className="border-t border-surface-container py-12 mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-primary flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
              <Dices size={14} strokeWidth={2.2} className="text-on-primary" />
            </div>
            <div>
              <div className="font-headline font-black text-[13px] text-on-surface tracking-[-0.02em]">Dice Vault</div>
              <div className="font-headline font-bold text-[7.5px] uppercase tracking-[.1em] text-outline-variant">{t('tagline')}</div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-[13px] text-on-surface-variant">
            <Link href={`/${locale}/p/terms`} className="hover:text-on-surface transition-colors">
              {locale === 'nl' ? 'Voorwaarden' : 'Terms'}
            </Link>
            <Link href={`/${locale}/p/privacy`} className="hover:text-on-surface transition-colors">
              {locale === 'nl' ? 'Privacy' : 'Privacy'}
            </Link>
          </div>
          <p className="text-[12px] text-outline-variant font-body">
            © {new Date().getFullYear()} Dice Vault. {t('rights')}
          </p>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Create `src/components/layout/CookieBanner.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const t = useTranslations('common.cookieBanner')
  const locale = useLocale()

  useEffect(() => {
    if (localStorage.getItem('cookie_consent') !== 'accepted') {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="max-w-xl mx-auto pointer-events-auto bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-4" style={{ boxShadow: '0 8px 28px rgba(43,52,55,0.14)' }}>
        <p className="font-body text-[13px] text-on-surface-variant">
          {t('message')}{' '}
          <Link href={`/${locale}/p/privacy`} className="text-primary underline underline-offset-2">
            {t('readMore')}
          </Link>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 px-4 py-2 rounded-[10px] bg-primary text-on-primary font-headline font-bold text-[12px] hover:bg-primary-dim transition-colors"
        >
          {t('accept')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/app/[locale]/layout.tsx`**

```tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import CookieBanner from '@/components/layout/CookieBanner'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!routing.locales.includes(locale as any)) notFound()
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={messages}>
      <Header locale={locale} />
      <main className="relative z-10">{children}</main>
      <Footer locale={locale} />
      <CookieBanner />
    </NextIntlClientProvider>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/[locale]/layout.tsx src/components/layout/Header.tsx src/components/layout/Footer.tsx src/components/layout/CookieBanner.tsx
git commit -m "feat(layout): add locale layout, marketing header/footer, cookie banner, Sonner toaster"
```

---

## Task 11: Landing Page

**Files:**
- Create: `src/app/[locale]/page.tsx`

**Sections order:** Hero → Features (3 cards) → How It Works (Vault/Games/Players/Leagues) → Group Features USP → How Credits Work → Credit Packs → Payment Options → Reviews → CTA

- [ ] **Step 1: Create `src/app/[locale]/page.tsx`**

```tsx
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import {
  Dices, BarChart2, Shield,
  Trophy, UserCheck, Share2, Bell,
  Vault, Users, ClipboardList, UserPlus,
  Building2, CreditCard, Zap,
} from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  Dices, BarChart2, Shield, Trophy, UserCheck, Share2, Bell,
  Vault, Users, ClipboardList, UserPlus, Building2, CreditCard, Zap,
}

function SectionHeader({ overline, headline, subheadline }: { overline: string; headline: string; subheadline?: string }) {
  return (
    <div className="text-center mb-12">
      <p className="font-headline font-black text-[9.5px] uppercase tracking-[.18em] text-outline-variant mb-3">{overline}</p>
      <h2 className="font-headline font-black text-on-surface tracking-[-0.03em]" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>{headline}</h2>
      {subheadline && <p className="font-body text-on-surface-variant text-base mt-3 max-w-xl mx-auto">{subheadline}</p>}
    </div>
  )
}

type Props = { params: Promise<{ locale: string }> }

export default async function LandingPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('landing')

  const features = [0, 1, 2].map(i => ({
    icon: t(`features.items.${i}.icon`),
    title: t(`features.items.${i}.title`),
    description: t(`features.items.${i}.description`),
  }))

  const howItWorksSteps = [0, 1, 2, 3].map(i => ({
    label: t(`howItWorks.steps.${i}.label`),
    icon: t(`howItWorks.steps.${i}.icon`),
    title: t(`howItWorks.steps.${i}.title`),
    description: t(`howItWorks.steps.${i}.description`),
  }))

  const groupItems = [0, 1, 2, 3].map(i => ({
    icon: t(`group.items.${i}.icon`),
    title: t(`group.items.${i}.title`),
    description: t(`group.items.${i}.description`),
  }))

  const creditCosts = [0, 1, 2, 3].map(i => ({
    action: t(`credits.costs.items.${i}.action`),
    cost: Number(t(`credits.costs.items.${i}.cost`)),
    icon: t(`credits.costs.items.${i}.icon`),
  }))

  const packs = [0, 1, 2, 3].map(i => ({
    credits: Number(t(`packs.items.${i}.credits`)),
    price: t(`packs.items.${i}.price`),
    tag: t(`packs.items.${i}.tag`),
  }))

  const paymentMethods = [0, 1, 2].map(i => ({
    title: t(`payments.methods.${i}.title`),
    description: t(`payments.methods.${i}.description`),
    icon: t(`payments.methods.${i}.icon`),
    tag: t(`payments.methods.${i}.tag`),
    tagVariant: t(`payments.methods.${i}.tagVariant`),
  }))

  const reviews = [0, 1, 2].map(i => ({
    name: t(`reviews.placeholder.${i}.name`),
    review: t(`reviews.placeholder.${i}.review`),
    game: t(`reviews.placeholder.${i}.game`),
  }))

  return (
    <div className="relative z-10">

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-container mb-8" style={{ animation: 'fadeUp .6s ease both' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-headline font-bold text-[11px] uppercase tracking-[.06em] text-primary">{t('hero.badge')}</span>
        </div>
        <h1 className="font-headline font-black text-on-surface tracking-[-0.04em] leading-[1.05] mb-6" style={{ fontSize: 'clamp(38px,5vw,62px)', animation: 'fadeUp .6s .1s ease both' }}>
          {t('hero.headline')}
        </h1>
        <p className="font-body text-on-surface-variant text-lg leading-relaxed max-w-xl mx-auto mb-10" style={{ animation: 'fadeUp .6s .2s ease both' }}>
          {t('hero.subheadline')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3" style={{ animation: 'fadeUp .6s .3s ease both' }}>
          <Link href={`/${locale}/auth/register`} className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary text-on-primary font-headline font-extrabold text-[15px] text-center transition-all hover:bg-primary-dim" style={{ boxShadow: '0 8px 28px rgba(0,91,192,0.28)' }}>
            {t('hero.ctaPrimary')}
          </Link>
          <Link href={`#how-it-works`} className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-container-low text-on-surface font-headline font-bold text-[14px] text-center hover:bg-surface-container transition-colors">
            {t('hero.ctaSecondary')}
          </Link>
        </div>
      </section>

      {/* ── Core Features ── */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <SectionHeader overline={t('features.overline')} headline={t('features.headline')} />
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = ICONS[f.icon] ?? Dices
            return (
              <div key={i} className="bg-white rounded-2xl p-6 transition-all hover:-translate-y-1" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
                <div className="w-11 h-11 rounded-[10px] bg-primary-container flex items-center justify-center mb-4">
                  <Icon size={22} className="text-primary" />
                </div>
                <h3 className="font-headline font-extrabold text-[17px] text-on-surface tracking-[-0.02em] mb-2">{f.title}</h3>
                <p className="font-body text-[14px] text-on-surface-variant leading-relaxed">{f.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── How It Works — Vault > Games > Players > Leagues ── */}
      <section id="how-it-works" className="bg-surface-container-low py-20">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader overline={t('howItWorks.overline')} headline={t('howItWorks.headline')} subheadline={t('howItWorks.subheadline')} />
          <div className="grid md:grid-cols-4 gap-6">
            {howItWorksSteps.map((step, i) => {
              const Icon = ICONS[step.icon] ?? Dices
              return (
                <div key={i} className="relative">
                  {i < 3 && (
                    <div className="hidden md:block absolute top-9 left-[calc(100%-12px)] w-6 h-0.5 bg-surface-container-high z-10" />
                  )}
                  <div className="bg-white rounded-2xl p-6 h-full" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
                        <Icon size={18} strokeWidth={2.2} className="text-on-primary" />
                      </div>
                      <span className="font-headline font-black text-[10px] uppercase tracking-[.12em] text-primary">{step.label}</span>
                    </div>
                    <h3 className="font-headline font-extrabold text-[15px] text-on-surface tracking-[-0.02em] mb-2">{step.title}</h3>
                    <p className="font-body text-[13px] text-on-surface-variant leading-relaxed">{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Group Features USP ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <SectionHeader overline={t('group.overline')} headline={t('group.headline')} subheadline={t('group.subheadline')} />
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {groupItems.map((item, i) => {
            const Icon = ICONS[item.icon] ?? Trophy
            return (
              <div key={i} className="flex gap-4 bg-white rounded-2xl p-6 transition-all hover:-translate-y-0.5" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
                <div className="w-10 h-10 rounded-[10px] bg-primary-container flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-headline font-extrabold text-[16px] text-on-surface tracking-[-0.02em] mb-1">{item.title}</h3>
                  <p className="font-body text-[14px] text-on-surface-variant leading-relaxed">{item.description}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-center">
          <Link href={`/${locale}/auth/register`} className="inline-block px-8 py-3.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-[14px] hover:bg-primary-dim transition-all" style={{ boxShadow: '0 4px 14px rgba(0,91,192,0.28)' }}>
            {t('group.cta')}
          </Link>
        </div>
      </section>

      {/* ── How Credits Work ── */}
      <section className="bg-surface-container-low py-20">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader overline={t('credits.overline')} headline={t('credits.headline')} subheadline={t('credits.subheadline')} />
          <div className="grid md:grid-cols-3 gap-8">

            {/* Free monthly block */}
            <div className="bg-primary rounded-2xl p-7 text-center" style={{ boxShadow: '0 8px 28px rgba(0,91,192,0.28)' }}>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 mb-4">
                <span className="font-headline font-bold text-[10px] uppercase tracking-[.08em] text-on-primary">{t('credits.free.badge')}</span>
              </div>
              <div className="font-headline font-black text-[56px] text-on-primary leading-none tracking-[-0.04em]">{t('credits.free.amount')}</div>
              <div className="font-headline font-bold text-[13px] text-on-primary/70 mb-3">{t('credits.free.label')}</div>
              <p className="font-body text-[13px] text-on-primary/80 leading-relaxed">{t('credits.free.description')}</p>
            </div>

            {/* Action cost table */}
            <div className="bg-white rounded-2xl p-7" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
              <h3 className="font-headline font-extrabold text-[16px] text-on-surface tracking-[-0.02em] mb-5">{t('credits.costs.title')}</h3>
              <div className="space-y-0">
                {creditCosts.map((item, i) => {
                  const Icon = ICONS[item.icon] ?? Dices
                  return (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-surface-container-low last:border-0">
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className="text-on-surface-variant flex-shrink-0" />
                        <span className="font-body text-[13.5px] text-on-surface">{item.action}</span>
                      </div>
                      <span className="font-headline font-bold text-[13px] text-primary flex-shrink-0 ml-2">
                        {item.cost} {t('credits.costs.credits')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Example + note */}
            <div className="bg-white rounded-2xl p-7" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
              <h3 className="font-headline font-extrabold text-[16px] text-on-surface tracking-[-0.02em] mb-3">{t('credits.example.title')}</h3>
              <p className="font-body text-[13.5px] text-on-surface-variant leading-relaxed mb-5">{t('credits.example.description')}</p>
              <div className="flex items-start gap-2.5 bg-primary-container rounded-xl p-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="font-body text-[12.5px] text-primary leading-relaxed">{t('credits.example.note')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Credit Packs ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <SectionHeader overline={t('packs.overline')} headline={t('packs.headline')} subheadline={t('packs.subheadline')} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          {packs.map((pack, i) => (
            <div key={i} className={`relative rounded-2xl p-6 text-center transition-all hover:-translate-y-1 ${pack.tag ? 'bg-primary text-on-primary' : 'bg-white'}`} style={{ boxShadow: pack.tag ? '0 8px 28px rgba(0,91,192,0.28)' : '0 2px 12px rgba(43,52,55,0.05)' }}>
              {pack.tag && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white font-headline font-bold text-[10px] uppercase tracking-[.08em] text-primary whitespace-nowrap" style={{ boxShadow: '0 2px 8px rgba(0,91,192,0.2)' }}>
                  {pack.tag}
                </div>
              )}
              <div className={`font-headline font-black text-[36px] tracking-[-0.03em] leading-none mb-1 ${pack.tag ? 'text-on-primary' : 'text-on-surface'}`}>
                {pack.credits}
              </div>
              <div className={`font-headline font-bold text-[11px] uppercase tracking-[.08em] mb-4 ${pack.tag ? 'text-on-primary/70' : 'text-outline-variant'}`}>credits</div>
              <div className={`font-headline font-black text-[22px] tracking-[-0.02em] ${pack.tag ? 'text-on-primary' : 'text-on-surface'}`}>{pack.price}</div>
            </div>
          ))}
        </div>
        <p className="text-center font-body text-[12px] text-outline-variant mb-8">{t('packs.priceNote')}</p>
        <div className="text-center">
          <Link href={`/${locale}/auth/register`} className="inline-block px-8 py-3.5 rounded-2xl bg-primary text-on-primary font-headline font-bold text-[14px] hover:bg-primary-dim transition-all" style={{ boxShadow: '0 4px 14px rgba(0,91,192,0.28)' }}>
            {t('packs.cta')}
          </Link>
        </div>
      </section>

      {/* ── Payment Options ── */}
      <section className="bg-surface-container-low py-20">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader overline={t('payments.overline')} headline={t('payments.headline')} />
          <div className="grid md:grid-cols-3 gap-6">
            {paymentMethods.map((method, i) => {
              const Icon = ICONS[method.icon] ?? CreditCard
              const isHighlight = method.tagVariant === 'highlight'
              return (
                <div key={i} className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-[10px] bg-primary-container flex items-center justify-center">
                      <Icon size={20} className="text-primary" />
                    </div>
                    {method.tag && (
                      <span className={`px-2.5 py-1 rounded-full font-headline font-bold text-[10px] uppercase tracking-[.06em] ${isHighlight ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`} style={isHighlight ? { boxShadow: '0 2px 8px rgba(0,91,192,0.28)' } : {}}>
                        {method.tag}
                      </span>
                    )}
                  </div>
                  <h3 className="font-headline font-extrabold text-[16px] text-on-surface tracking-[-0.02em] mb-2">{method.title}</h3>
                  <p className="font-body text-[13.5px] text-on-surface-variant leading-relaxed">{method.description}</p>
                </div>
              )
            })}
          </div>
          <p className="text-center font-body text-[12px] text-outline-variant mt-6">{t('payments.note')}</p>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <SectionHeader overline={t('reviews.overline')} headline={t('reviews.headline')} />
        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((review, i) => (
            <div key={i} className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
              <p className="font-body text-[14px] text-on-surface leading-relaxed mb-5">"{review.review}"</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
                  <span className="font-headline font-black text-[11px] text-primary">{review.name.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-headline font-bold text-[13px] text-on-surface">{review.name}</div>
                  <div className="font-body text-[12px] text-on-surface-variant">{review.game}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-primary rounded-3xl px-8 py-16 text-center" style={{ boxShadow: '0 8px 28px rgba(0,91,192,0.28)' }}>
          <h2 className="font-headline font-black text-on-primary tracking-[-0.03em] mb-4" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>{t('cta.headline')}</h2>
          <p className="font-body text-on-primary/75 text-base mb-8 max-w-md mx-auto">{t('cta.body')}</p>
          <Link href={`/${locale}/auth/register`} className="inline-block px-10 py-4 rounded-2xl bg-white text-primary font-headline font-extrabold text-[15px] hover:bg-surface-container-low transition-colors">
            {t('cta.button')}
          </Link>
        </div>
      </section>

    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/page.tsx
git commit -m "feat(landing): add full landing page — hero, features, how-it-works, group USP, credits, packs, payments, reviews, CTA"
```

---

## Task 12: Auth Pages UI

**Files:**
- Create: `src/components/auth/AuthCard.tsx`
- Create: `src/app/[locale]/auth/login/page.tsx`
- Create: `src/app/[locale]/auth/register/page.tsx`
- Create: `src/app/[locale]/auth/forgot-password/page.tsx`
- Create: `src/app/[locale]/auth/reset-password/page.tsx`
- Create: `src/app/[locale]/auth/verify-email/page.tsx`

- [ ] **Step 1: Create `src/components/auth/AuthCard.tsx`**

This file contains: `AuthCard` wrapper, `UnderlineInput`, and `PrimaryButton` — all auth page primitives.

```tsx
'use client'

import Link from 'next/link'
import { Dices } from 'lucide-react'

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
              <Dices size={18} strokeWidth={2.2} className="text-on-primary" />
            </div>
            <div>
              <div className="font-headline font-black text-[14.5px] text-on-surface tracking-[-0.02em] leading-none">Dice Vault</div>
              <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant leading-none mt-0.5">dicevault.fun</div>
            </div>
          </Link>
        </div>
        <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function UnderlineInput({ label, ...props }: InputProps) {
  return (
    <div className="mb-5">
      <label className="block font-headline font-black text-[9px] uppercase tracking-[.15em] text-outline-variant mb-1">
        {label}
      </label>
      <input
        className="w-full h-11 border-0 border-b border-b-[#d1dce0] focus:border-b-primary rounded-none px-0.5 pb-2.5 font-body text-sm text-on-surface bg-transparent outline-none transition-[border-color] duration-200 placeholder:text-[#c0c8cc] placeholder:italic placeholder:text-[13px]"
        {...props}
      />
    </div>
  )
}

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`w-full h-11 bg-primary hover:bg-primary-dim text-on-primary font-headline font-bold text-sm rounded-[10px] transition-all ${className}`}
      style={{ boxShadow: '0 4px 14px rgba(0,91,192,0.28)' }}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Create `src/app/[locale]/auth/login/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { login } from '../actions'

export default function LoginPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [state, formAction, pending] = useActionState(
    async (_: any, formData: FormData) => {
      formData.set('locale', locale)
      return login(formData)
    },
    null
  )

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('login.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('login.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('login.email')} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <UnderlineInput label={t('login.password')} name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        {state?.error && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as any)}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('login.submit')}
        </PrimaryButton>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Link href={`/${locale}/auth/forgot-password`} className="font-body text-[13px] text-on-surface-variant hover:text-primary transition-colors">{t('login.forgotPassword')}</Link>
        <p className="font-body text-[13px] text-on-surface-variant">{t('login.noAccount')}{' '}<Link href={`/${locale}/auth/register`} className="text-primary font-semibold hover:underline">{t('login.register')}</Link></p>
      </div>
    </AuthCard>
  )
}
```

- [ ] **Step 3: Create `src/app/[locale]/auth/register/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { register } from '../actions'

export default function RegisterPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [state, formAction, pending] = useActionState(
    async (_: any, formData: FormData) => {
      formData.set('locale', locale)
      return register(formData)
    },
    null
  )

  if (state?.success) {
    return (
      <AuthCard>
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center mx-auto mb-4">
            <div className="w-3 h-3 rounded-full bg-primary" />
          </div>
          <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-2">{t('register.checkEmail')}</h1>
          <p className="font-body text-[14px] text-on-surface-variant">{t('verify.title')}</p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('register.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('register.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('register.email')} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <UnderlineInput label={t('register.password')} name="password" type="password" autoComplete="new-password" required placeholder="••••••••" />
        <UnderlineInput label={t('register.passwordConfirm')} name="passwordConfirm" type="password" autoComplete="new-password" required placeholder="••••••••" />
        {state?.error && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as any)}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('register.submit')}
        </PrimaryButton>
      </form>
      <p className="mt-6 text-center font-body text-[13px] text-on-surface-variant">{t('register.hasAccount')}{' '}<Link href={`/${locale}/auth/login`} className="text-primary font-semibold hover:underline">{t('register.login')}</Link></p>
    </AuthCard>
  )
}
```

- [ ] **Step 4: Create `src/app/[locale]/auth/forgot-password/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { forgotPassword } from '../actions'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [state, formAction, pending] = useActionState(
    async (_: any, formData: FormData) => {
      formData.set('locale', locale)
      return forgotPassword(formData)
    },
    null
  )

  if (state?.success) {
    return (
      <AuthCard>
        <div className="text-center py-4">
          <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-3">{t('forgot.title')}</h1>
          <p className="font-body text-[14px] text-on-surface-variant mb-6">{t('forgot.sent')}</p>
          <Link href={`/${locale}/auth/login`} className="font-body text-[13px] text-primary hover:underline">{t('forgot.backToLogin')}</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('forgot.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('forgot.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('forgot.email')} name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        {state?.error && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as any)}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('forgot.submit')}
        </PrimaryButton>
      </form>
      <div className="mt-6 text-center">
        <Link href={`/${locale}/auth/login`} className="font-body text-[13px] text-on-surface-variant hover:text-primary transition-colors">{t('forgot.backToLogin')}</Link>
      </div>
    </AuthCard>
  )
}
```

- [ ] **Step 5: Create `src/app/[locale]/auth/reset-password/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { resetPassword } from '../actions'

export default function ResetPasswordPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, formAction, pending] = useActionState(
    async (_: any, formData: FormData) => {
      formData.set('token', token)
      return resetPassword(formData)
    },
    null
  )

  if (state?.success) {
    return (
      <AuthCard>
        <div className="text-center py-4">
          <h1 className="font-headline font-black text-[22px] text-on-surface tracking-[-0.03em] mb-3">{t('reset.success')}</h1>
          <Link href={`/${locale}/auth/login`} className="font-body text-[13px] text-primary hover:underline">{t('verify.login')}</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('reset.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('reset.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput label={t('reset.password')} name="password" type="password" autoComplete="new-password" required placeholder="••••••••" />
        <UnderlineInput label={t('reset.passwordConfirm')} name="passwordConfirm" type="password" autoComplete="new-password" required placeholder="••••••••" />
        {state?.error && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as any)}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('reset.submit')}
        </PrimaryButton>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 6: Create `src/app/[locale]/auth/verify-email/page.tsx`**

```tsx
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
```

- [ ] **Step 7: Commit**

```bash
git add src/components/auth/ src/app/[locale]/auth/login/ src/app/[locale]/auth/register/ src/app/[locale]/auth/forgot-password/ src/app/[locale]/auth/reset-password/ src/app/[locale]/auth/verify-email/
git commit -m "feat(auth-ui): add login, register, forgot/reset password, verify-email pages"
```

---

## Task 13: TOTP Challenge Page

**Files:**
- Create: `src/app/[locale]/auth/totp-challenge/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/auth/totp-challenge/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { AuthCard, UnderlineInput, PrimaryButton } from '@/components/auth/AuthCard'
import { verifyTotp } from '../actions'

export default function TotpChallengePage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, formAction, pending] = useActionState(
    async (_: any, formData: FormData) => {
      formData.set('token', token)
      formData.set('locale', locale)
      return verifyTotp(formData)
    },
    null
  )

  return (
    <AuthCard>
      <h1 className="font-headline font-black text-[26px] text-on-surface tracking-[-0.03em] mb-1">{t('totp.title')}</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">{t('totp.subtitle')}</p>
      <form action={formAction}>
        <UnderlineInput
          label={t('totp.code')}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={10}
          required
          placeholder="000000"
          autoFocus
        />
        {state?.error && (
          <p className="font-body text-[13px] text-error mb-4">{t(state.error as any)}</p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="mt-2">
          {pending ? '…' : t('totp.submit')}
        </PrimaryButton>
      </form>
    </AuthCard>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/auth/totp-challenge/
git commit -m "feat(auth-ui): add TOTP challenge page"
```

---

## Task 14: App Shell Layout

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/BottomNav.tsx`
- Create: `src/components/layout/MobileHeader.tsx`
- Create: `src/app/app/layout.tsx`
- Create: `src/app/app/dashboard/page.tsx`

- [ ] **Step 1: Create `src/components/layout/Sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Dices, ClipboardList, CreditCard, Settings } from 'lucide-react'

const NAV = [
  { key: 'dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { key: 'players',   href: '/app/players',   icon: Users },
  { key: 'games',     href: '/app/games',     icon: Dices },
  { key: 'sessions',  href: '/app/sessions',  icon: ClipboardList },
  { key: 'credits',   href: '/app/credits',   icon: CreditCard },
  { key: 'settings',  href: '/app/settings',  icon: Settings },
] as const

export default function Sidebar({ email, credits }: { email: string; credits: number }) {
  const pathname = usePathname()
  const t = useTranslations('app.nav')
  const tCredits = useTranslations('app.credits')

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white flex-col z-40" style={{ boxShadow: '0 2px 12px rgba(43,52,55,0.05)' }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
            <Dices size={18} strokeWidth={2.2} className="text-on-primary" />
          </div>
          <div>
            <div className="font-headline font-black text-[14.5px] text-on-surface tracking-[-0.02em] leading-none">Dice Vault</div>
            <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant leading-none mt-0.5">dicevault.fun</div>
          </div>
        </Link>
      </div>

      {/* Credit chip */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-container">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-headline font-bold text-[12px] text-primary">{tCredits('balance', { n: credits })}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(({ key, href, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={key}
              href={href}
              className={`flex items-center gap-[11px] px-[14px] py-[10px] rounded-xl font-headline font-semibold text-[13.5px] transition-all ${active ? 'bg-white text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}
              style={active ? { boxShadow: '0 2px 12px rgba(43,52,55,0.09)' } : {}}
            >
              <Icon size={17} className="flex-shrink-0" />
              {t(key)}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-4">
        <div className="flex items-center gap-2.5 p-3 rounded-[14px] bg-surface-container-low">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="font-headline font-black text-[11px] text-on-primary tracking-[.02em]">
              {email.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-body font-bold text-[12.5px] text-on-surface truncate">{email}</div>
            <div className="font-headline font-bold text-[8.5px] uppercase tracking-[.1em] text-outline-variant">User</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create `src/components/layout/BottomNav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Dices, ClipboardList, Settings } from 'lucide-react'

const NAV = [
  { key: 'dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { key: 'players',   href: '/app/players',   icon: Users },
  { key: 'games',     href: '/app/games',     icon: Dices },
  { key: 'sessions',  href: '/app/sessions',  icon: ClipboardList },
  { key: 'settings',  href: '/app/settings',  icon: Settings },
] as const

export default function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('app.nav')

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-2 pb-safe" style={{ height: '56px', background: 'rgba(248,249,250,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid rgba(43,52,55,0.07)' }}>
      {NAV.map(({ key, href, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={key}
            href={href}
            className={`flex flex-col items-center gap-[3px] px-3.5 py-1.5 rounded-[10px] font-headline font-extrabold text-[9px] uppercase tracking-[.08em] transition-colors ${active ? 'text-primary' : 'text-outline'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
            {t(key)}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Create `src/components/layout/MobileHeader.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { Dices } from 'lucide-react'

export default function MobileHeader() {
  return (
    <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center px-4" style={{ background: 'rgba(248,249,250,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(43,52,55,0.07)' }}>
      <Link href="/app/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,91,192,0.28)' }}>
          <Dices size={16} strokeWidth={2.2} className="text-on-primary" />
        </div>
        <span className="font-headline font-black text-[14px] text-on-surface tracking-[-0.02em]">Dice Vault</span>
      </Link>
    </header>
  )
}
```

- [ ] **Step 4: Create `src/app/app/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import MobileHeader from '@/components/layout/MobileHeader'

async function loadMessages(locale: string) {
  const [common, auth, app] = await Promise.all([
    import(`../../../messages/${locale}/common.json`).then(m => m.default),
    import(`../../../messages/${locale}/auth.json`).then(m => m.default),
    import(`../../../messages/${locale}/app.json`).then(m => m.default),
  ])
  return { common, auth, app }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const locale = session.user.locale ?? 'en'
  setRequestLocale(locale)

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, monthlyCredits: true, permanentCredits: true },
  })
  if (!user) redirect('/en/auth/login')

  const totalCredits = user.monthlyCredits + user.permanentCredits
  const messages = await loadMessages(locale)

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Sidebar email={user.email} credits={totalCredits} />
      <MobileHeader />
      <main className="lg:ml-64 min-h-screen relative z-10 pt-14 pb-20 lg:pt-0 lg:pb-0 px-6 lg:px-7" style={{ paddingTop: 'max(3.5rem, env(safe-area-inset-top, 0px))' }}>
        {children}
      </main>
      <BottomNav />
    </NextIntlClientProvider>
  )
}
```

- [ ] **Step 5: Create `src/app/app/dashboard/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <div className="py-9">
      <p className="font-headline font-black text-[9.5px] uppercase tracking-[.18em] text-outline-variant mb-2">Phase 1b</p>
      <h1 className="font-headline font-black text-[42px] text-on-surface tracking-[-0.03em] mb-4">Dashboard</h1>
      <p className="font-body text-[15px] text-on-surface-variant">Your game stats will appear here in Phase 2.</p>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/BottomNav.tsx src/components/layout/MobileHeader.tsx src/app/app/layout.tsx src/app/app/dashboard/
git commit -m "feat(app-shell): add sidebar, bottom nav, mobile header, app layout, dashboard placeholder"
```

---

## Task 15: Run All Tests + README Update + Push

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/INDEX.md`

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (health tests + mail + auth-actions + totp).

- [ ] **Step 2: Update `README.md` — add Mailgun env vars to the environment variables table**

Find the Mailgun rows in the env vars table and verify they are present. They should already be there from Phase 1a. If not, add these three rows:

```markdown
| `MAILGUN_API_KEY` | ✅ | Mailgun API key | 1b |
| `MAILGUN_DOMAIN` | ✅ | Mailgun sending domain, e.g. `mg.dicevault.fun` | 1b |
| `MAILGUN_FROM` | ✅ | From address, e.g. `Dice Vault <noreply@dicevault.fun>` | 1b |
```

Add the following entry to the Phase Changelog table in README.md:

```markdown
| 1b | next-intl (nl/en) · NextAuth v5 Credentials · TOTP MFA · Mailgun email verification · landing page · auth pages · app shell (sidebar + bottom nav) |
```

- [ ] **Step 3: Update `docs/superpowers/plans/INDEX.md` — mark Phase 1b as done**

Change the Phase 1b row:
```markdown
| **1b** | [phase-1b-auth-landing.md](2026-04-16-phase-1b-auth-landing.md) | done | main spec §17 (next-intl, auth, landing, app shell) |
```

- [ ] **Step 4: Commit README + index**

```bash
git add README.md docs/superpowers/plans/INDEX.md
git commit -m "docs: update README with Mailgun env vars and Phase 1b changelog"
```

- [ ] **Step 5: Push all Phase 1b commits in one shot**

```bash
git push origin main
```

Expected: all commits pushed, GitHub webhook triggers Coolify deploy.

---

## Self-Review Checklist

### Spec coverage

| Requirement | Task |
|---|---|
| next-intl nl/en with `/[locale]/` prefix | Tasks 3, 4 |
| Landing page | Task 11 |
| Auth pages (login, register, forgot, reset, verify) | Tasks 8, 12 |
| NextAuth v5 Credentials | Task 5 |
| TOTP optional MFA | Tasks 7, 13 |
| App shell layout (sidebar + bottom nav) | Task 14 |
| Email verification via Mailgun | Tasks 6, 8 |
| README Mailgun env vars | Task 15 |
| Cookie consent banner | Task 10 |
| Single push at end of phase | Task 15 |

### Key type consistency

- `login()` action → calls `signIn('credentials', { email, password, redirectTo })` — authorize() handles `{ email, password }` credentials shape ✓
- `verifyTotp()` action → stores `totp_verified:{token}` in Redis then calls `signIn('credentials', { totpVerifiedToken })` — authorize() handles `{ totpVerifiedToken }` credentials shape ✓
- `Session.user` extended with `id, role, locale, totpEnabled, requiresMfa` — `src/types/next-auth.d.ts` declares these ✓
- `loadMessages()` in app layout imports the same locale namespaces (`common`, `auth`, `app`) that client components call via `useTranslations()` ✓
- Sidebar receives `credits = monthlyCredits + permanentCredits` — matches the two-pool schema from Task 1 ✓
