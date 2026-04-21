# Game Wizard Phase 2b — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-step free-text game template wizard with a structured 5-step adaptive wizard that captures win type, scoring configuration, buy-in tracking, and game identity (colour + icon).

**Architecture:** The wizard is split into 5 focused step components, each receiving shared state and an update callback from a container page. Win type resolution is extracted to a pure tested function. The server action is updated to persist all new fields. The Prisma schema gains 14 new fields with database-level defaults so existing templates remain valid.

**Tech Stack:** Next.js 15 App Router, Prisma 5, TypeScript, next-intl (en/nl), Vitest, Sonner toasts, Lucide icons, inline styles matching existing design system

---

## File map

**Create:**
- `src/app/app/games/new/wizard-types.ts` — `WinType` union, `Q1/Q2/Q3Answer` types, `WizardState` interface, `INITIAL_WIZARD_STATE`, `COLORS[]`, `ICONS[]`
- `src/app/app/games/new/win-type-resolver.ts` — `resolveWinType()` pure function
- `src/app/app/games/new/step1-basics.tsx` — Name input, colour palette grid, icon picker grid
- `src/app/app/games/new/step2-win-type.tsx` — Q1/Q2/Q3 guided question flow + result pill
- `src/app/app/games/new/step3-scoring.tsx` — Scoring config panel, adapts to win type
- `src/app/app/games/new/step4-details.tsx` — Description, min/max players, scoring notes, buy-in
- `src/app/app/games/new/step5-confirm.tsx` — Preview card + summary rows
- `src/test/win-type-resolver.test.ts` — Vitest unit tests for the resolver function

**Modify:**
- `prisma/schema.prisma` — 14 new fields on `GameTemplate`
- `src/app/app/games/actions.ts` — Expanded `CreateGameTemplateInput` type + `createGameTemplate` body
- `src/app/app/games/new/page.tsx` — Replace 3-step with 5-step wizard container
- `src/app/app/games/page.tsx` — Show template colour dot + emoji icon instead of static `Dices` icon
- `src/test/games-actions.test.ts` — Update existing tests to new input shape + add persistence test
- `messages/en/app.json` — Replace `games.wizard` object with 5-step keys
- `messages/nl/app.json` — Same, Dutch
- `messages/en/landing.json` — Add `gameTypes` section (9 win type cards)
- `messages/nl/landing.json` — Same, Dutch
- `src/app/[locale]/(marketing)/page.tsx` — Insert Game Types section between How It Works and Group Features

---

### Task 1: Prisma schema migration

**Files:**
- Modify: `prisma/schema.prisma:51-60`

- [ ] **Step 1: Update the GameTemplate model in schema.prisma**

Replace the existing `GameTemplate` model (lines 51–60) with:

```prisma
model GameTemplate {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String
  description     String?
  scoringNotes    String?
  color           String    @default("#f5a623")
  icon            String    @default("🎲")
  winType         String    @default("points-all")
  winCondition    String?
  scoreFields     String[]  @default([])
  roles           String[]  @default([])
  missions        String[]  @default([])
  trackDifficulty Boolean   @default(false)
  trackTeamScores Boolean   @default(false)
  timeUnit        String?
  buyInEnabled    Boolean   @default(false)
  buyInCurrency   String?
  minPlayers      Int?
  maxPlayers      Int?
  leagues         League[]
  createdAt       DateTime  @default(now())
}
```

- [ ] **Step 2: Create the migration file (don't apply yet)**

```bash
npx prisma migrate dev --create-only --name add_game_template_fields
```

Expected: a new file created at `prisma/migrations/<timestamp>_add_game_template_fields/migration.sql`.

- [ ] **Step 3: Append backfill SQL to the generated migration file**

Open `prisma/migrations/<timestamp>_add_game_template_fields/migration.sql` and append at the end:

```sql
-- Backfill existing templates: points-all win type defaults to "high" win condition
UPDATE "GameTemplate" SET "winCondition" = 'high' WHERE "winType" = 'points-all';
```

- [ ] **Step 4: Apply the migration**

```bash
npx prisma migrate dev
```

Expected: migration applied, Prisma client regenerated, no errors.

- [ ] **Step 5: Verify client has new fields**

```bash
npx prisma generate
```

Expected: no errors. The generated client now includes `color`, `icon`, `winType`, `winCondition`, etc. on `gameTemplate`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add 14 new fields to GameTemplate for phase 2b wizard"
```

---

### Task 2: i18n strings

**Files:**
- Modify: `messages/en/app.json`
- Modify: `messages/nl/app.json`
- Modify: `messages/en/landing.json`
- Modify: `messages/nl/landing.json`

- [ ] **Step 1: Replace games.wizard in messages/en/app.json**

Replace the `"wizard"` object under `"games"` (currently the keys `step1Title` through `creating`) with:

```json
"wizard": {
  "step1Title": "Game identity",
  "namePlaceholder": "Game name (e.g. Catan)",
  "colorLabel": "Colour",
  "iconLabel": "Icon",
  "step2Title": "How does it play?",
  "q1Label": "How are results tracked?",
  "q1PointsAll": "Scores — all players",
  "q1PointsWinner": "Scores — winner only",
  "q1Time": "Time (fastest wins)",
  "q1Ranking": "Finish order (1st, 2nd, 3rd…)",
  "q1Elimination": "Last one standing",
  "q1Declaration": "Someone is declared winner",
  "q2Label": "Who plays?",
  "q2Teams": "Teams",
  "q2Cooperative": "Everyone together",
  "q2Individual": "Individual players",
  "q3Label": "Are there secret roles or missions?",
  "q3No": "No",
  "q3Roles": "Secret roles",
  "q3Missions": "Secret missions",
  "winTypeConfirmed": "Win type: {label}",
  "feedbackLink": "Missing a win type? Send us feedback →",
  "winTypeLabels": {
    "points-all": "Points — All players",
    "points-winner": "Points — Winner only",
    "time": "Time",
    "ranking": "Ranking",
    "elimination": "Elimination",
    "winner": "Winner declaration",
    "cooperative": "Cooperative",
    "team": "Team vs Team",
    "secret-mission": "Secret Mission"
  },
  "step3Title": "Scoring setup",
  "winConditionLabel": "Win condition",
  "winConditionHigh": "Highest score wins",
  "winConditionLow": "Lowest score wins",
  "scoreFieldsLabel": "Score fields",
  "addField": "+ Add field",
  "fieldPlaceholder": "Field name (e.g. Points)",
  "removeField": "Remove",
  "rolesToggle": "Enable role assignments?",
  "rolesLabel": "Roles",
  "addRole": "+ Add role",
  "rolePlaceholder": "Role name (e.g. Werewolf)",
  "missionsToggle": "Enable secret missions?",
  "missionsLabel": "Missions",
  "addMission": "+ Add mission",
  "missionPlaceholder": "Mission name (e.g. Conquer Europe)",
  "difficultyToggle": "Track difficulty / threat level?",
  "teamScoresToggle": "Track team scores?",
  "timeUnitLabel": "Time unit",
  "timeSeconds": "Seconds",
  "timeMinutes": "Minutes",
  "timeMmss": "mm:ss",
  "rankingInfo": "Players are ranked by finish order. No additional configuration needed.",
  "eliminationInfo": "Last player standing wins. No additional configuration needed.",
  "step4Title": "Details",
  "descriptionPlaceholder": "Short description (optional)",
  "minPlayersPlaceholder": "Min players",
  "maxPlayersPlaceholder": "Max players",
  "scoringNotesPlaceholder": "Rules reminder / scoring notes (optional)",
  "buyInToggle": "Track buy-ins?",
  "buyInCurrencyLabel": "Currency",
  "step5Title": "Confirm",
  "summaryWinType": "Win type",
  "summaryWinCondition": "Win condition",
  "summaryScoreFields": "Score fields",
  "summaryPlayers": "Players",
  "summaryBuyIn": "Buy-in",
  "buyInEnabled": "Enabled ({currency})",
  "buyInDisabled": "Disabled",
  "cost": "This costs 25 credits",
  "confirm": "Create game",
  "back": "Back",
  "next": "Next",
  "creating": "Creating..."
}
```

- [ ] **Step 2: Replace games.wizard in messages/nl/app.json**

Replace the `"wizard"` object under `"games"` with:

```json
"wizard": {
  "step1Title": "Spelidentiteit",
  "namePlaceholder": "Naam van het spel (bijv. Catan)",
  "colorLabel": "Kleur",
  "iconLabel": "Pictogram",
  "step2Title": "Hoe wordt er gespeeld?",
  "q1Label": "Hoe worden resultaten bijgehouden?",
  "q1PointsAll": "Scores — alle spelers",
  "q1PointsWinner": "Scores — alleen winnaar",
  "q1Time": "Tijd (snelste wint)",
  "q1Ranking": "Eindvolgorde (1e, 2e, 3e…)",
  "q1Elimination": "Laatste overblijver",
  "q1Declaration": "Iemand wordt uitgeroepen als winnaar",
  "q2Label": "Wie speelt er?",
  "q2Teams": "Teams",
  "q2Cooperative": "Iedereen samen",
  "q2Individual": "Individuele spelers",
  "q3Label": "Zijn er geheime rollen of missies?",
  "q3No": "Nee",
  "q3Roles": "Geheime rollen",
  "q3Missions": "Geheime missies",
  "winTypeConfirmed": "Speltype: {label}",
  "feedbackLink": "Ontbreekt een speltype? Stuur ons feedback →",
  "winTypeLabels": {
    "points-all": "Punten — alle spelers",
    "points-winner": "Punten — alleen winnaar",
    "time": "Tijd",
    "ranking": "Eindvolgorde",
    "elimination": "Eliminatie",
    "winner": "Winnaar aanwijzen",
    "cooperative": "Coöperatief",
    "team": "Team vs. Team",
    "secret-mission": "Geheime missie"
  },
  "step3Title": "Scoreinstelling",
  "winConditionLabel": "Winconditie",
  "winConditionHigh": "Hoogste score wint",
  "winConditionLow": "Laagste score wint",
  "scoreFieldsLabel": "Scorevelden",
  "addField": "+ Veld toevoegen",
  "fieldPlaceholder": "Veldnaam (bijv. Punten)",
  "removeField": "Verwijderen",
  "rolesToggle": "Rolinstellingen inschakelen?",
  "rolesLabel": "Rollen",
  "addRole": "+ Rol toevoegen",
  "rolePlaceholder": "Rolnaam (bijv. Weerwolf)",
  "missionsToggle": "Geheime missies inschakelen?",
  "missionsLabel": "Missies",
  "addMission": "+ Missie toevoegen",
  "missionPlaceholder": "Missienaam (bijv. Europa veroveren)",
  "difficultyToggle": "Moeilijkheidsgraad bijhouden?",
  "teamScoresToggle": "Teamscores bijhouden?",
  "timeUnitLabel": "Tijdseenheid",
  "timeSeconds": "Seconden",
  "timeMinutes": "Minuten",
  "timeMmss": "mm:ss",
  "rankingInfo": "Spelers worden gerangschikt op eindvolgorde. Geen extra configuratie nodig.",
  "eliminationInfo": "De laatste speler wint. Geen extra configuratie nodig.",
  "step4Title": "Details",
  "descriptionPlaceholder": "Korte beschrijving (optioneel)",
  "minPlayersPlaceholder": "Min. spelers",
  "maxPlayersPlaceholder": "Max. spelers",
  "scoringNotesPlaceholder": "Spelregelherinnering / scorenotities (optioneel)",
  "buyInToggle": "Buy-ins bijhouden?",
  "buyInCurrencyLabel": "Valuta",
  "step5Title": "Bevestigen",
  "summaryWinType": "Speltype",
  "summaryWinCondition": "Winconditie",
  "summaryScoreFields": "Scorevelden",
  "summaryPlayers": "Spelers",
  "summaryBuyIn": "Buy-in",
  "buyInEnabled": "Ingeschakeld ({currency})",
  "buyInDisabled": "Uitgeschakeld",
  "cost": "Dit kost 25 credits",
  "confirm": "Spel aanmaken",
  "back": "Terug",
  "next": "Volgende",
  "creating": "Aanmaken..."
}
```

- [ ] **Step 3: Add gameTypes to messages/en/landing.json**

Add as a new top-level key before the final `}` of the JSON file:

```json
"gameTypes": {
  "overline": "Every game type",
  "headline": "Built for the games you actually play",
  "subheadline": "Whatever you track, Dice Vault handles it.",
  "items": [
    { "icon": "🎲", "title": "Points", "description": "Track scores for every player. Perfect for Catan, Ticket to Ride, and anything with a points tally." },
    { "icon": "🏆", "title": "High score", "description": "Only the winner's score matters. Great for arcade-style games and speed rounds." },
    { "icon": "⏱", "title": "Fastest wins", "description": "Race games and speed challenges. Lowest time takes the crown." },
    { "icon": "🥇", "title": "Finish order", "description": "Who came first, second, third? Track placements across every session." },
    { "icon": "⚔️", "title": "Last one standing", "description": "Elimination games where the final survivor wins." },
    { "icon": "👑", "title": "Winner declared", "description": "Card games and hidden-role games where someone wins by declaration." },
    { "icon": "🛡️", "title": "Co-op", "description": "The whole group wins or loses together. Optionally track difficulty levels." },
    { "icon": "🤝", "title": "Team vs Team", "description": "Split into teams and track which side comes out on top." },
    { "icon": "🔮", "title": "Secret mission", "description": "Players have hidden objectives revealed at the end. Who pulled it off?" }
  ]
}
```

- [ ] **Step 4: Add gameTypes to messages/nl/landing.json**

Add the same section with Dutch translations:

```json
"gameTypes": {
  "overline": "Elk speltype",
  "headline": "Gemaakt voor de spellen die jij écht speelt",
  "subheadline": "Wat je ook bijhoudt, Dice Vault regelt het.",
  "items": [
    { "icon": "🎲", "title": "Punten", "description": "Scores bijhouden voor elke speler. Perfect voor Catan, Ticket to Ride en alles met punten." },
    { "icon": "🏆", "title": "Hoogste score", "description": "Alleen de score van de winnaar telt. Ideaal voor arcade-spellen en snelheidsrondes." },
    { "icon": "⏱", "title": "Snelste wint", "description": "Racespellen en tijduitdagingen. De laagste tijd wint." },
    { "icon": "🥇", "title": "Eindvolgorde", "description": "Wie eindigde als eerste, tweede, derde? Sla elke plaatsing op." },
    { "icon": "⚔️", "title": "Laatste overblijver", "description": "Eliminatiespellen waarbij de laatste speler wint." },
    { "icon": "👑", "title": "Winnaar aanwijzen", "description": "Kaartspellen en verborgen-rolspellen waarbij iemand als winnaar wordt uitgeroepen." },
    { "icon": "🛡️", "title": "Coöperatief", "description": "De hele groep wint of verliest samen. Optioneel moeilijkheidsgraad bijhouden." },
    { "icon": "🤝", "title": "Team vs. Team", "description": "Verdeel in teams en kijk welke kant wint." },
    { "icon": "🔮", "title": "Geheime missie", "description": "Spelers hebben verborgen doelen die aan het einde onthuld worden. Wie slaagde erin?" }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add 5-step wizard and game types landing section strings (en + nl)"
```

---

### Task 3: Win type resolver + shared types

**Files:**
- Create: `src/app/app/games/new/wizard-types.ts`
- Create: `src/app/app/games/new/win-type-resolver.ts`
- Create: `src/test/win-type-resolver.test.ts`

- [ ] **Step 1: Create wizard-types.ts**

```typescript
export type WinType =
  | 'points-all'
  | 'points-winner'
  | 'time'
  | 'ranking'
  | 'elimination'
  | 'winner'
  | 'cooperative'
  | 'team'
  | 'secret-mission'

export type Q1Answer = 'points-all' | 'points-winner' | 'time' | 'ranking' | 'elimination' | 'declaration'
export type Q2Answer = 'team' | 'cooperative' | 'individual'
export type Q3Answer = 'no' | 'roles' | 'missions'

export interface WizardState {
  name: string
  color: string
  icon: string
  q1: Q1Answer | null
  q2: Q2Answer | null
  q3: Q3Answer | null
  winType: WinType | null
  rolesEnabled: boolean
  winCondition: 'high' | 'low' | null
  scoreFields: string[]
  roles: string[]
  missions: string[]
  trackDifficulty: boolean
  trackTeamScores: boolean
  timeUnit: 'seconds' | 'minutes' | 'mmss' | null
  description: string
  minPlayers: string
  maxPlayers: string
  scoringNotes: string
  buyInEnabled: boolean
  buyInCurrency: string
}

export const INITIAL_WIZARD_STATE: WizardState = {
  name: '',
  color: '#f5a623',
  icon: '🎲',
  q1: null,
  q2: null,
  q3: null,
  winType: null,
  rolesEnabled: false,
  winCondition: null,
  scoreFields: [],
  roles: [],
  missions: [],
  trackDifficulty: false,
  trackTeamScores: false,
  timeUnit: null,
  description: '',
  minPlayers: '',
  maxPlayers: '',
  scoringNotes: '',
  buyInEnabled: false,
  buyInCurrency: '€',
}

export const COLORS: string[] = [
  '#e74c3c', '#e67e22', '#f5a623', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#2980b9', '#9b59b6', '#8e44ad',
  '#e91e63', '#ff5722', '#795548', '#607d8b', '#34495e',
  '#16a085', '#27ae60', '#d35400', '#c0392b', '#7f8c8d',
]

export const ICONS: string[] = [
  '🎲', '🏆', '⚔️', '🛡️', '👑', '⭐', '🗺️', '🔮',
  '🎯', '🧩', '🃏', '♟️', '🎭', '🔑', '💎', '🏹',
  '🧙', '🐉', '🌍', '🎪', '🚀', '⚓', '🌊', '🔥',
  '❄️', '🌙', '☀️', '🎸', '🎺', '🎻',
]
```

- [ ] **Step 2: Write failing tests for the win type resolver**

Create `src/test/win-type-resolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveWinType } from '@/app/app/games/new/win-type-resolver'

describe('resolveWinType', () => {
  it('returns incomplete when q1 is null', () => {
    expect(resolveWinType({ q1: null, q2: null, q3: null }))
      .toEqual({ winType: null, rolesEnabled: false, isComplete: false })
  })

  it('resolves points-all directly from q1', () => {
    expect(resolveWinType({ q1: 'points-all', q2: null, q3: null }))
      .toEqual({ winType: 'points-all', rolesEnabled: false, isComplete: true })
  })

  it('resolves points-winner directly from q1', () => {
    expect(resolveWinType({ q1: 'points-winner', q2: null, q3: null }))
      .toEqual({ winType: 'points-winner', rolesEnabled: false, isComplete: true })
  })

  it('resolves time directly from q1', () => {
    expect(resolveWinType({ q1: 'time', q2: null, q3: null }))
      .toEqual({ winType: 'time', rolesEnabled: false, isComplete: true })
  })

  it('resolves ranking directly from q1', () => {
    expect(resolveWinType({ q1: 'ranking', q2: null, q3: null }))
      .toEqual({ winType: 'ranking', rolesEnabled: false, isComplete: true })
  })

  it('resolves elimination directly from q1', () => {
    expect(resolveWinType({ q1: 'elimination', q2: null, q3: null }))
      .toEqual({ winType: 'elimination', rolesEnabled: false, isComplete: true })
  })

  it('returns incomplete when q1=declaration and q2 is null', () => {
    expect(resolveWinType({ q1: 'declaration', q2: null, q3: null }))
      .toEqual({ winType: null, rolesEnabled: false, isComplete: false })
  })

  it('resolves team from declaration + q2=team', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'team', q3: null }))
      .toEqual({ winType: 'team', rolesEnabled: false, isComplete: true })
  })

  it('resolves cooperative from declaration + q2=cooperative', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'cooperative', q3: null }))
      .toEqual({ winType: 'cooperative', rolesEnabled: false, isComplete: true })
  })

  it('returns incomplete when declaration + individual + q3=null', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'individual', q3: null }))
      .toEqual({ winType: null, rolesEnabled: false, isComplete: false })
  })

  it('resolves winner (no roles) from q3=no', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'individual', q3: 'no' }))
      .toEqual({ winType: 'winner', rolesEnabled: false, isComplete: true })
  })

  it('resolves winner with rolesEnabled from q3=roles', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'individual', q3: 'roles' }))
      .toEqual({ winType: 'winner', rolesEnabled: true, isComplete: true })
  })

  it('resolves secret-mission from q3=missions', () => {
    expect(resolveWinType({ q1: 'declaration', q2: 'individual', q3: 'missions' }))
      .toEqual({ winType: 'secret-mission', rolesEnabled: false, isComplete: true })
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/test/win-type-resolver.test.ts
```

Expected: all 13 tests FAIL with "Cannot find module '@/app/app/games/new/win-type-resolver'"

- [ ] **Step 4: Implement win-type-resolver.ts**

```typescript
import type { Q1Answer, Q2Answer, Q3Answer, WinType } from './wizard-types'

interface WinTypeQuestions {
  q1: Q1Answer | null
  q2: Q2Answer | null
  q3: Q3Answer | null
}

interface ResolvedWinType {
  winType: WinType | null
  rolesEnabled: boolean
  isComplete: boolean
}

export function resolveWinType(q: WinTypeQuestions): ResolvedWinType {
  if (q.q1 === null) return { winType: null, rolesEnabled: false, isComplete: false }

  if (q.q1 !== 'declaration') {
    return { winType: q.q1, rolesEnabled: false, isComplete: true }
  }

  if (q.q2 === null) return { winType: null, rolesEnabled: false, isComplete: false }
  if (q.q2 === 'team') return { winType: 'team', rolesEnabled: false, isComplete: true }
  if (q.q2 === 'cooperative') return { winType: 'cooperative', rolesEnabled: false, isComplete: true }

  if (q.q3 === null) return { winType: null, rolesEnabled: false, isComplete: false }
  if (q.q3 === 'no') return { winType: 'winner', rolesEnabled: false, isComplete: true }
  if (q.q3 === 'roles') return { winType: 'winner', rolesEnabled: true, isComplete: true }
  return { winType: 'secret-mission', rolesEnabled: false, isComplete: true }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run src/test/win-type-resolver.test.ts
```

Expected: 13 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/games/new/wizard-types.ts src/app/app/games/new/win-type-resolver.ts src/test/win-type-resolver.test.ts
git commit -m "feat(wizard): add win type resolver, shared types, and constants"
```

---

### Task 4: Update server action + tests

**Files:**
- Modify: `src/app/app/games/actions.ts`
- Modify: `src/test/games-actions.test.ts`

- [ ] **Step 1: Update the test file first**

Replace the full contents of `src/test/games-actions.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    gameTemplate: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/credits', () => ({
  deductCredits: vi.fn().mockResolvedValue({ newMonthly: 50, newPermanent: 0 }),
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    constructor() { super('Insufficient credits') }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deductCredits, checkRateLimit } from '@/lib/credits'
import { createGameTemplate, deleteGameTemplate } from '@/app/app/games/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

const fullInput = {
  name: 'Catan',
  color: '#f5a623',
  icon: '🎲',
  winType: 'points-all',
  winCondition: 'high' as string | null,
  scoreFields: [] as string[],
  roles: [] as string[],
  missions: [] as string[],
  trackDifficulty: false,
  trackTeamScores: false,
  timeUnit: null as string | null,
  description: '',
  minPlayers: null as number | null,
  maxPlayers: null as number | null,
  scoringNotes: '',
  buyInEnabled: false,
  buyInCurrency: null as string | null,
}

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
})

describe('createGameTemplate', () => {
  it('checks rate limit and deducts credits', async () => {
    vi.mocked(prisma.gameTemplate.create).mockResolvedValue({ id: 'gt1' } as never)
    const result = await createGameTemplate(fullInput)
    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 'game_template')
    expect(deductCredits).toHaveBeenCalledWith('user-1', 'game_template', expect.any(Object))
    expect(result).toEqual({ success: true, id: 'gt1' })
  })

  it('returns error when name is empty', async () => {
    const result = await createGameTemplate({ ...fullInput, name: '' })
    expect(result).toEqual({ success: false, error: 'errors.required' })
    expect(deductCredits).not.toHaveBeenCalled()
  })

  it('returns insufficientCredits error on InsufficientCreditsError', async () => {
    const { InsufficientCreditsError } = await import('@/lib/credits')
    vi.mocked(deductCredits).mockRejectedValueOnce(new InsufficientCreditsError())
    const result = await createGameTemplate(fullInput)
    expect(result).toEqual({ success: false, error: 'errors.insufficientCredits' })
  })

  it('persists all new fields to the database', async () => {
    vi.mocked(prisma.gameTemplate.create).mockResolvedValue({ id: 'gt2' } as never)
    await createGameTemplate({
      ...fullInput,
      name: 'Werewolf',
      winType: 'winner',
      winCondition: null,
      roles: ['Werewolf', 'Villager'],
      buyInEnabled: true,
      buyInCurrency: '€',
    })
    expect(prisma.gameTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        winType: 'winner',
        roles: ['Werewolf', 'Villager'],
        buyInEnabled: true,
        buyInCurrency: '€',
      }),
    })
  })
})

describe('deleteGameTemplate', () => {
  it('deletes own template', async () => {
    vi.mocked(prisma.gameTemplate.findUnique).mockResolvedValue({ id: 'gt1', userId: 'user-1' } as never)
    vi.mocked(prisma.gameTemplate.delete).mockResolvedValue({ id: 'gt1' } as never)
    const result = await deleteGameTemplate('gt1')
    expect(result).toEqual({ success: true })
  })

  it("rejects delete of another user's template", async () => {
    vi.mocked(prisma.gameTemplate.findUnique).mockResolvedValue({ id: 'gt1', userId: 'other' } as never)
    const result = await deleteGameTemplate('gt1')
    expect(result).toEqual({ success: false, error: 'errors.notFound' })
  })
})
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
npx vitest run src/test/games-actions.test.ts
```

Expected: "checks rate limit" and "persists all new fields" tests FAIL because the action still uses the old 3-field input.

- [ ] **Step 3: Replace actions.ts**

```typescript
'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deductCredits, checkRateLimit, InsufficientCreditsError } from '@/lib/credits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type CreateGameTemplateInput = {
  name: string
  color: string
  icon: string
  winType: string
  winCondition: string | null
  scoreFields: string[]
  roles: string[]
  missions: string[]
  trackDifficulty: boolean
  trackTeamScores: boolean
  timeUnit: string | null
  description: string
  minPlayers: number | null
  maxPlayers: number | null
  scoringNotes: string
  buyInEnabled: boolean
  buyInCurrency: string | null
}

export async function createGameTemplate(
  input: CreateGameTemplateInput
): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const name = input.name.trim()
  if (!name) return { success: false, error: 'errors.required' }

  try {
    await checkRateLimit(session.user.id, 'game_template')
    await deductCredits(session.user.id, 'game_template', { action: 'create_game_template' })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false, error: 'errors.insufficientCredits' }
    if ((err as Error).message.startsWith('Rate limit')) return { success: false, error: 'errors.serverError' }
    return { success: false, error: 'errors.serverError' }
  }

  const template = await prisma.gameTemplate.create({
    data: {
      userId: session.user.id,
      name,
      color: input.color,
      icon: input.icon,
      winType: input.winType,
      winCondition: input.winCondition ?? null,
      scoreFields: input.scoreFields,
      roles: input.roles,
      missions: input.missions,
      trackDifficulty: input.trackDifficulty,
      trackTeamScores: input.trackTeamScores,
      timeUnit: input.timeUnit ?? null,
      description: input.description.trim() || null,
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      scoringNotes: input.scoringNotes.trim() || null,
      buyInEnabled: input.buyInEnabled,
      buyInCurrency: input.buyInCurrency ?? null,
    },
  })

  revalidatePath('/app/games')
  return { success: true, id: template.id }
}

export async function deleteGameTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const template = await prisma.gameTemplate.findUnique({ where: { id } })
  if (!template || template.userId !== session.user.id) return { success: false, error: 'errors.notFound' }

  await prisma.gameTemplate.delete({ where: { id } })
  revalidatePath('/app/games')
  return { success: true }
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx vitest run src/test/games-actions.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/games/actions.ts src/test/games-actions.test.ts
git commit -m "feat(actions): expand createGameTemplate to persist all phase 2b fields"
```

---

### Task 5: Step 1 — Basics component

**Files:**
- Create: `src/app/app/games/new/step1-basics.tsx`

- [ ] **Step 1: Create step1-basics.tsx**

```typescript
'use client'
import { useTranslations } from 'next-intl'
import { COLORS, ICONS, type WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

export function Step1Basics({ state, onChange }: Props) {
  const t = useTranslations('app.games.wizard')

  return (
    <div className="space-y-6">
      <div>
        <input
          autoFocus
          value={state.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder={t('namePlaceholder')}
          className="w-full px-4 py-3 rounded-xl border font-body text-sm"
          style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
          onFocus={e => (e.target.style.borderColor = '#f5a623')}
          onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
        />
      </div>

      <div>
        <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('colorLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              className="w-7 h-7 rounded-full transition-transform"
              style={{
                background: c,
                outline: state.color === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
                boxShadow: state.color === c ? '0 0 0 1px #fff, 0 0 0 3px ' + c : 'none',
                transform: state.color === c ? 'scale(1.2)' : 'scale(1)',
              }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('iconLabel')}</p>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map(icon => (
            <button
              key={icon}
              type="button"
              onClick={() => onChange({ icon })}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
              style={{
                background: state.icon === icon ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: state.icon === icon ? '1.5px solid #f5a623' : '1.5px solid transparent',
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/games/new/step1-basics.tsx
git commit -m "feat(wizard): add Step 1 — game identity (name, colour, icon)"
```

---

### Task 6: Step 2 — Win type component

**Files:**
- Create: `src/app/app/games/new/step2-win-type.tsx`

- [ ] **Step 1: Create step2-win-type.tsx**

```typescript
'use client'
import { useTranslations } from 'next-intl'
import { resolveWinType } from './win-type-resolver'
import type { Q1Answer, Q2Answer, Q3Answer, WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

function optionBtn(active: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    borderRadius: 12,
    border: active ? '1.5px solid #f5a623' : '1.5px solid #e8e1d8',
    background: active ? 'rgba(245,166,35,0.08)' : '#fffdf9',
    color: active ? '#c47f00' : '#4a3f2f',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    display: 'block',
    transition: 'all 0.15s',
  }
}

export function Step2WinType({ state, onChange }: Props) {
  const t = useTranslations('app.games.wizard')

  function setQ1(q1: Q1Answer) {
    onChange({ q1, q2: null, q3: null, winType: null, rolesEnabled: false })
  }
  function setQ2(q2: Q2Answer) {
    onChange({ q2, q3: null, winType: null, rolesEnabled: false })
  }
  function setQ3(q3: Q3Answer) {
    const resolved = resolveWinType({ q1: state.q1, q2: state.q2, q3 })
    onChange({ q3, winType: resolved.winType, rolesEnabled: resolved.rolesEnabled })
  }

  const resolved = resolveWinType({ q1: state.q1, q2: state.q2, q3: state.q3 })
  const winTypeLabel = resolved.winType
    ? t(`winTypeLabels.${resolved.winType}` as Parameters<typeof t>[0])
    : null

  const q1Options: { value: Q1Answer; label: string }[] = [
    { value: 'points-all',   label: t('q1PointsAll') },
    { value: 'points-winner',label: t('q1PointsWinner') },
    { value: 'time',         label: t('q1Time') },
    { value: 'ranking',      label: t('q1Ranking') },
    { value: 'elimination',  label: t('q1Elimination') },
    { value: 'declaration',  label: t('q1Declaration') },
  ]

  const q2Options: { value: Q2Answer; label: string }[] = [
    { value: 'team',        label: t('q2Teams') },
    { value: 'cooperative', label: t('q2Cooperative') },
    { value: 'individual',  label: t('q2Individual') },
  ]

  const q3Options: { value: Q3Answer; label: string }[] = [
    { value: 'no',       label: t('q3No') },
    { value: 'roles',    label: t('q3Roles') },
    { value: 'missions', label: t('q3Missions') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="font-headline font-bold text-xs mb-3" style={{ color: '#4a3f2f' }}>{t('q1Label')}</p>
        <div className="space-y-2">
          {q1Options.map(o => (
            <button key={o.value} type="button" style={optionBtn(state.q1 === o.value)} onClick={() => setQ1(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {state.q1 === 'declaration' && (
        <div>
          <p className="font-headline font-bold text-xs mb-3" style={{ color: '#4a3f2f' }}>{t('q2Label')}</p>
          <div className="space-y-2">
            {q2Options.map(o => (
              <button key={o.value} type="button" style={optionBtn(state.q2 === o.value)} onClick={() => setQ2(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.q1 === 'declaration' && state.q2 === 'individual' && (
        <div>
          <p className="font-headline font-bold text-xs mb-3" style={{ color: '#4a3f2f' }}>{t('q3Label')}</p>
          <div className="space-y-2">
            {q3Options.map(o => (
              <button key={o.value} type="button" style={optionBtn(state.q3 === o.value)} onClick={() => setQ3(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {resolved.isComplete && winTypeLabel && (
        <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.25)', color: '#1a7a42' }}>
          {t('winTypeConfirmed', { label: winTypeLabel })}
        </div>
      )}

      <p className="text-xs font-body" style={{ color: '#9a8878' }}>{t('feedbackLink')}</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/games/new/step2-win-type.tsx
git commit -m "feat(wizard): add Step 2 — adaptive win type questions with result pill"
```

---

### Task 7: Step 3 — Scoring setup component

**Files:**
- Create: `src/app/app/games/new/step3-scoring.tsx`

- [ ] **Step 1: Create step3-scoring.tsx**

```typescript
'use client'
import { useTranslations } from 'next-intl'
import type { WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

function Toggle({ value, onToggle, label }: { value: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="font-body text-sm" style={{ color: '#4a3f2f' }}>{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? '#f5a623' : '#e8e1d8' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{ background: '#fff', left: value ? 'calc(100% - 22px)' : 2 }}
        />
      </button>
    </div>
  )
}

function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  addLabel: string
  removeLabel: string
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item}
            onChange={e => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-xl border font-body text-sm"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="px-3 py-2 rounded-xl font-headline font-bold text-xs"
            style={{ background: '#f0ebe3', color: '#9a8878' }}
          >
            {removeLabel}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="font-headline font-bold text-xs px-3 py-2 rounded-xl"
        style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}
      >
        {addLabel}
      </button>
    </div>
  )
}

export function Step3Scoring({ state, onChange }: Props) {
  const t = useTranslations('app.games.wizard')
  const wt = state.winType

  if (wt === 'points-all' || wt === 'points-winner') {
    return (
      <div className="space-y-5">
        <div>
          <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winConditionLabel')}</p>
          <div className="flex gap-2">
            {(['high', 'low'] as const).map(cond => (
              <button
                key={cond}
                type="button"
                onClick={() => onChange({ winCondition: cond })}
                className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm"
                style={{
                  background: state.winCondition === cond ? '#f5a623' : '#f0ebe3',
                  color: state.winCondition === cond ? '#1c1408' : '#4a3f2f',
                }}
              >
                {cond === 'high' ? t('winConditionHigh') : t('winConditionLow')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('scoreFieldsLabel')}</p>
          <StringListEditor
            items={state.scoreFields}
            onChange={scoreFields => onChange({ scoreFields })}
            placeholder={t('fieldPlaceholder')}
            addLabel={t('addField')}
            removeLabel={t('removeField')}
          />
        </div>
      </div>
    )
  }

  if (wt === 'winner') {
    return (
      <div className="space-y-4">
        <Toggle
          value={state.rolesEnabled}
          onToggle={() => onChange({ rolesEnabled: !state.rolesEnabled, roles: [] })}
          label={t('rolesToggle')}
        />
        {state.rolesEnabled && (
          <div>
            <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('rolesLabel')}</p>
            <StringListEditor
              items={state.roles}
              onChange={roles => onChange({ roles })}
              placeholder={t('rolePlaceholder')}
              addLabel={t('addRole')}
              removeLabel={t('removeField')}
            />
          </div>
        )}
      </div>
    )
  }

  if (wt === 'secret-mission') {
    const missionsOn = state.missions.length > 0
    return (
      <div className="space-y-4">
        <Toggle
          value={missionsOn}
          onToggle={() => onChange({ missions: missionsOn ? [] : [''] })}
          label={t('missionsToggle')}
        />
        {missionsOn && (
          <div>
            <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('missionsLabel')}</p>
            <StringListEditor
              items={state.missions}
              onChange={missions => onChange({ missions })}
              placeholder={t('missionPlaceholder')}
              addLabel={t('addMission')}
              removeLabel={t('removeField')}
            />
          </div>
        )}
      </div>
    )
  }

  if (wt === 'cooperative') {
    return (
      <Toggle
        value={state.trackDifficulty}
        onToggle={() => onChange({ trackDifficulty: !state.trackDifficulty })}
        label={t('difficultyToggle')}
      />
    )
  }

  if (wt === 'team') {
    return (
      <Toggle
        value={state.trackTeamScores}
        onToggle={() => onChange({ trackTeamScores: !state.trackTeamScores })}
        label={t('teamScoresToggle')}
      />
    )
  }

  if (wt === 'time') {
    const options = [
      { value: 'seconds' as const, label: t('timeSeconds') },
      { value: 'minutes' as const, label: t('timeMinutes') },
      { value: 'mmss'    as const, label: t('timeMmss') },
    ]
    return (
      <div>
        <p className="font-headline font-bold text-xs mb-3" style={{ color: '#4a3f2f' }}>{t('timeUnitLabel')}</p>
        <div className="flex gap-2">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ timeUnit: o.value })}
              className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm"
              style={{
                background: state.timeUnit === o.value ? '#f5a623' : '#f0ebe3',
                color: state.timeUnit === o.value ? '#1c1408' : '#4a3f2f',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (wt === 'ranking') {
    return <p className="font-body text-sm leading-relaxed" style={{ color: '#9a8878' }}>{t('rankingInfo')}</p>
  }

  if (wt === 'elimination') {
    return <p className="font-body text-sm leading-relaxed" style={{ color: '#9a8878' }}>{t('eliminationInfo')}</p>
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/games/new/step3-scoring.tsx
git commit -m "feat(wizard): add Step 3 — scoring setup panel (adapts to all 9 win types)"
```

---

### Task 8: Step 4 — Details component

**Files:**
- Create: `src/app/app/games/new/step4-details.tsx`

- [ ] **Step 1: Create step4-details.tsx**

```typescript
'use client'
import { useTranslations } from 'next-intl'
import type { WizardState } from './wizard-types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
}

const CURRENCIES = ['€', '$', '£', 'kr', 'pts']

const fieldStyle: React.CSSProperties = {
  borderColor: '#e8e1d8',
  outline: 'none',
  background: '#fffdf9',
}

export function Step4Details({ state, onChange }: Props) {
  const t = useTranslations('app.games.wizard')

  return (
    <div className="space-y-4">
      <input
        value={state.description}
        onChange={e => onChange({ description: e.target.value })}
        placeholder={t('descriptionPlaceholder')}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm"
        style={fieldStyle}
        onFocus={e => (e.target.style.borderColor = '#f5a623')}
        onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
      />

      <div className="flex gap-3">
        <input
          type="number"
          min={1}
          value={state.minPlayers}
          onChange={e => onChange({ minPlayers: e.target.value })}
          placeholder={t('minPlayersPlaceholder')}
          className="flex-1 px-4 py-3 rounded-xl border font-body text-sm"
          style={fieldStyle}
          onFocus={e => (e.target.style.borderColor = '#f5a623')}
          onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
        />
        <input
          type="number"
          min={1}
          value={state.maxPlayers}
          onChange={e => onChange({ maxPlayers: e.target.value })}
          placeholder={t('maxPlayersPlaceholder')}
          className="flex-1 px-4 py-3 rounded-xl border font-body text-sm"
          style={fieldStyle}
          onFocus={e => (e.target.style.borderColor = '#f5a623')}
          onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
        />
      </div>

      <textarea
        value={state.scoringNotes}
        onChange={e => onChange({ scoringNotes: e.target.value })}
        placeholder={t('scoringNotesPlaceholder')}
        rows={4}
        className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
        style={fieldStyle}
        onFocus={e => (e.target.style.borderColor = '#f5a623')}
        onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
      />

      <div className="rounded-xl p-4 space-y-3" style={{ background: '#f9f5ee', border: '1px solid #e8e1d8' }}>
        <div className="flex items-center justify-between">
          <span className="font-headline font-bold text-sm" style={{ color: '#4a3f2f' }}>{t('buyInToggle')}</span>
          <button
            type="button"
            onClick={() => onChange({ buyInEnabled: !state.buyInEnabled })}
            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
            style={{ background: state.buyInEnabled ? '#f5a623' : '#e8e1d8' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
              style={{ background: '#fff', left: state.buyInEnabled ? 'calc(100% - 22px)' : 2 }}
            />
          </button>
        </div>

        {state.buyInEnabled && (
          <div>
            <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('buyInCurrencyLabel')}</p>
            <div className="flex gap-2 flex-wrap">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ buyInCurrency: c })}
                  className="px-4 py-2 rounded-xl font-headline font-bold text-sm"
                  style={{
                    background: state.buyInCurrency === c ? '#f5a623' : '#f0ebe3',
                    color: state.buyInCurrency === c ? '#1c1408' : '#4a3f2f',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/games/new/step4-details.tsx
git commit -m "feat(wizard): add Step 4 — details (description, players, notes, buy-in)"
```

---

### Task 9: Step 5 — Confirm component

**Files:**
- Create: `src/app/app/games/new/step5-confirm.tsx`

- [ ] **Step 1: Create step5-confirm.tsx**

```typescript
'use client'
import { useTranslations } from 'next-intl'
import type { WizardState } from './wizard-types'

interface Props {
  state: WizardState
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid #e8e1d8' }}>
      <span className="font-body text-xs" style={{ color: '#9a8878' }}>{label}</span>
      <span className="font-headline font-bold text-xs ml-4 text-right" style={{ color: '#4a3f2f', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

export function Step5Confirm({ state }: Props) {
  const t = useTranslations('app.games.wizard')

  const winTypeLabel = state.winType
    ? t(`winTypeLabels.${state.winType}` as Parameters<typeof t>[0])
    : '—'

  const winConditionLabel = state.winCondition === 'high'
    ? t('winConditionHigh')
    : state.winCondition === 'low'
    ? t('winConditionLow')
    : null

  const buyInLabel = state.buyInEnabled
    ? t('buyInEnabled', { currency: state.buyInCurrency })
    : t('buyInDisabled')

  const playersLabel = (state.minPlayers || state.maxPlayers)
    ? `${state.minPlayers || '?'} – ${state.maxPlayers || '?'}`
    : '—'

  const scoreFieldsSummary = state.scoreFields.filter(Boolean).join(', ') || null

  return (
    <div className="space-y-5">
      {/* Preview card */}
      <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: `${state.color}22` }}
        >
          {state.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-headline font-black text-base" style={{ color: '#1c1810' }}>{state.name}</div>
          {state.description && (
            <div className="text-xs font-body mt-0.5 truncate" style={{ color: '#9a8878' }}>{state.description}</div>
          )}
        </div>
        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: state.color }} />
      </div>

      {/* Summary rows */}
      <div>
        <SummaryRow label={t('summaryWinType')} value={winTypeLabel} />
        {winConditionLabel && <SummaryRow label={t('summaryWinCondition')} value={winConditionLabel} />}
        {scoreFieldsSummary && <SummaryRow label={t('summaryScoreFields')} value={scoreFieldsSummary} />}
        <SummaryRow label={t('summaryPlayers')} value={playersLabel} />
        <SummaryRow label={t('summaryBuyIn')} value={buyInLabel} />
      </div>

      {/* Credit cost notice */}
      <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
        {t('cost')}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/games/new/step5-confirm.tsx
git commit -m "feat(wizard): add Step 5 — confirm with preview card and summary rows"
```

---

### Task 10: Wizard container page

**Files:**
- Modify: `src/app/app/games/new/page.tsx`

- [ ] **Step 1: Replace page.tsx with the 5-step container**

```typescript
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { createGameTemplate } from '../actions'
import { INITIAL_WIZARD_STATE, type WizardState } from './wizard-types'
import { resolveWinType } from './win-type-resolver'
import { Step1Basics } from './step1-basics'
import { Step2WinType } from './step2-win-type'
import { Step3Scoring } from './step3-scoring'
import { Step4Details } from './step4-details'
import { Step5Confirm } from './step5-confirm'

type Step = 1 | 2 | 3 | 4 | 5
const TOTAL_STEPS = 5

export default function NewGamePage() {
  const t = useTranslations('app.games.wizard')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE)
  const [loading, setLoading] = useState(false)

  function patch(update: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...update }))
  }

  function canAdvance(): boolean {
    if (step === 1) return state.name.trim().length > 0
    if (step === 2) return resolveWinType({ q1: state.q1, q2: state.q2, q3: state.q3 }).isComplete
    return true
  }

  function handleNext() {
    if (!canAdvance()) {
      if (step === 1) toast.error(tErrors('required'))
      return
    }
    if (step === 2) {
      const resolved = resolveWinType({ q1: state.q1, q2: state.q2, q3: state.q3 })
      setState(prev => ({ ...prev, winType: resolved.winType, rolesEnabled: resolved.rolesEnabled }))
    }
    setStep(s => (s + 1) as Step)
  }

  async function handleSubmit() {
    setLoading(true)
    const result = await createGameTemplate({
      name: state.name,
      color: state.color,
      icon: state.icon,
      winType: state.winType!,
      winCondition: state.winCondition,
      scoreFields: state.scoreFields.filter(Boolean),
      roles: state.roles.filter(Boolean),
      missions: state.missions.filter(Boolean),
      trackDifficulty: state.trackDifficulty,
      trackTeamScores: state.trackTeamScores,
      timeUnit: state.timeUnit,
      description: state.description,
      minPlayers: state.minPlayers ? parseInt(state.minPlayers, 10) : null,
      maxPlayers: state.maxPlayers ? parseInt(state.maxPlayers, 10) : null,
      scoringNotes: state.scoringNotes,
      buyInEnabled: state.buyInEnabled,
      buyInCurrency: state.buyInEnabled ? state.buyInCurrency : null,
    })
    setLoading(false)
    if (!result.success) {
      toast.error(tErrors(result.error as never))
      return
    }
    toast.success(tToasts('templateCreated'))
    router.push('/app/games')
  }

  const stepTitles: Record<Step, string> = {
    1: t('step1Title'),
    2: t('step2Title'),
    3: t('step3Title'),
    4: t('step4Title'),
    5: t('step5Title'),
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-8">
        {([1, 2, 3, 4, 5] as Step[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center font-headline font-bold text-[11px]"
              style={{
                background: step >= s ? '#f5a623' : '#e8e1d8',
                color: step >= s ? '#1c1408' : '#9a8878',
              }}
            >
              {s}
            </div>
            {s < TOTAL_STEPS && (
              <div className="h-px w-5" style={{ background: step > s ? '#f5a623' : '#e8e1d8' }} />
            )}
          </div>
        ))}
        <span className="ml-2 font-headline font-semibold text-sm" style={{ color: '#4a3f2f' }}>
          {stepTitles[step]}
        </span>
      </div>

      <div className="p-6 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        {step === 1 && <Step1Basics state={state} onChange={patch} />}
        {step === 2 && <Step2WinType state={state} onChange={patch} />}
        {step === 3 && <Step3Scoring state={state} onChange={patch} />}
        {step === 4 && <Step4Details state={state} onChange={patch} />}
        {step === 5 && <Step5Confirm state={state} />}
      </div>

      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button
            onClick={() => setStep(s => (s - 1) as Step)}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f0ebe3', color: '#4a3f2f' }}
          >
            <ChevronLeft size={16} /> {t('back')}
          </button>
        )}
        <div className="flex-1" />
        {step < TOTAL_STEPS ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{
              background: canAdvance() ? '#f5a623' : '#e8e1d8',
              color: canAdvance() ? '#1c1408' : '#9a8878',
            }}
          >
            {t('next')} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {loading ? t('creating') : t('confirm')}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/games/new/page.tsx
git commit -m "feat(wizard): wire up 5-step wizard container replacing old 3-step wizard"
```

---

### Task 11: Games list page — show colour and icon

**Files:**
- Modify: `src/app/app/games/page.tsx`

- [ ] **Step 1: Update the template list item**

In `src/app/app/games/page.tsx`:

1. Replace the import line `import { Dices, Plus } from 'lucide-react'` with:

```typescript
import { Plus } from 'lucide-react'
```

2. Replace the `<li>` element (the one with `key={tmpl.id}`) with:

```typescript
<li key={tmpl.id} className="p-4 rounded-2xl flex items-center gap-3" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
  <div
    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
    style={{ background: `${tmpl.color}22` }}
  >
    {tmpl.icon}
  </div>
  <div className="flex-1 min-w-0">
    <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{tmpl.name}</div>
    {tmpl.description && <div className="text-xs font-body truncate mt-0.5" style={{ color: '#9a8878' }}>{tmpl.description}</div>}
  </div>
  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tmpl.color }} />
</li>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/games/page.tsx
git commit -m "feat(games): show template colour dot and emoji icon on list cards"
```

---

### Task 12: Landing page Game Types section

**Files:**
- Modify: `src/app/[locale]/(marketing)/page.tsx`

- [ ] **Step 1: Add gameTypeItems data extraction**

In `src/app/[locale]/(marketing)/page.tsx`, after the `reviews` array (around line 121, after `}))`) and before `return (`, add:

```typescript
const gameTypeItems = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => ({
  icon: t(`gameTypes.items.${i}.icon` as Parameters<typeof t>[0]),
  title: t(`gameTypes.items.${i}.title` as Parameters<typeof t>[0]),
  description: t(`gameTypes.items.${i}.description` as Parameters<typeof t>[0]),
}))
```

- [ ] **Step 2: Insert Game Types section between How It Works and Group Features**

Find the line `{/* ── Group Features ── */}` (around line 244) and insert immediately before it:

```typescript
{/* ── Game Types ── */}
<section className="max-w-5xl mx-auto px-6 py-20">
  <LPSectionHeader
    overline={t('gameTypes.overline')}
    headline={t('gameTypes.headline')}
    subheadline={t('gameTypes.subheadline')}
  />
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
    {gameTypeItems.map((item, i) => (
      <div key={i} className="rounded-2xl p-5 transition-all hover:-translate-y-1" style={{ ...card, transitionDuration: '200ms' }}>
        <div className="text-3xl mb-3">{item.icon}</div>
        <h3 className="font-headline font-extrabold text-[15px] tracking-[-0.02em] mb-1.5" style={{ color: text }}>{item.title}</h3>
        <p className="font-body text-[13px] leading-relaxed" style={{ color: muted }}>{item.description}</p>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/(marketing)/page.tsx"
git commit -m "feat(landing): add Game Types section showcasing all 9 win types"
```

---

### Task 13: Final integration check

- [ ] **Step 1: Run the complete test suite**

```bash
npx vitest run
```

Expected: all tests pass. The suite now includes 13 win-type-resolver tests and 5 updated games-action tests.

- [ ] **Step 2: Build check (TypeScript)**

```bash
npx tsc --noEmit
```

Expected: no errors. If TypeScript complains about `t('winTypeLabels.xxx' as Parameters<typeof t>[0])`, verify the `winTypeLabels` keys are present in both `en/app.json` and `nl/app.json`.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: phase 2b complete — 5-step adaptive game wizard with win types"
```
