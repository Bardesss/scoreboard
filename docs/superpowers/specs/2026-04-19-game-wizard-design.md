# Game Wizard — Design Spec
*Date: 2026-04-19*

---

## 1. Overview

Phase 2b redesigns the game template creation wizard. The current wizard (3 steps, free-text scoring notes) is replaced with a structured 5-step adaptive wizard that captures win type, scoring configuration, buy-in tracking, and game identity (colour + icon).

The result is a richer `GameTemplate` record that gives the session logger enough context to show the right input fields when a game is played.

---

## 2. Wizard flow (5 steps)

### Step 1 — Basics
- **Game name** (required)
- **Colour** — curated palette of 20 colours (hex values), one selected
- **Icon** — curated set of 30 Lucide-compatible emoji icons, one selected

### Step 2 — Win type (guided questions)
Three short questions that resolve to one of 9 internal win types. The user never sees type names — only plain-language questions.

**Q1 — How are results tracked?**

| Answer | Resolves to |
|---|---|
| Scores — all players | `points-all` |
| Scores — winner only | `points-winner` |
| Time (fastest wins) | `time` |
| Finish order (1st, 2nd, 3rd…) | `ranking` |
| Elimination (last one standing) | `elimination` |
| Declaration (someone is declared winner) | → Q2 |

**Q2 — Who plays? (only shown for Declaration)**

| Answer | Resolves to / continues |
|---|---|
| Teams | `team` |
| Everyone together | `cooperative` |
| Individual players | → Q3 |

**Q3 — Secret roles or missions? (only shown for Declaration + Individual)**

| Answer | Resolves to |
|---|---|
| No | `winner` |
| Secret roles | `winner` + roles enabled |
| Secret missions | `secret-mission` |

A **result pill** appears at the bottom of step 2 once the type is resolved, confirming the selection before the user continues.

A **"Missing a win type? Send us feedback →"** link appears below the questions (feedback form, later phase).

### Step 3 — Scoring setup (adapts to win type)

| Win type | Step 3 content |
|---|---|
| `points-all` / `points-winner` | Win condition toggle (Highest / Lowest wins) + optional score fields list (add/remove, auto-summed when logging) |
| `winner` | Role assignments toggle (Yes/No). If Yes: define role list (e.g. Werewolf, Villager, Seer) |
| `secret-mission` | Secret missions toggle (Yes/No). If Yes: define mission list (e.g. Conquer Europe). Missions revealed after game. |
| `cooperative` | Difficulty/threat level tracking toggle (Yes/No) |
| `team` | Team score tracking toggle (Yes/No). If Yes: highest team score wins. |
| `time` | Time unit selector: Seconds / Minutes / mm:ss. Lowest time always wins. |
| `ranking` / `elimination` | No configuration needed — informational screen only |

### Step 4 — Details (all optional)
- **Description** — short text
- **Min / max players** — number range
- **Scoring notes / rules reminder** — textarea, shown when logging
- **Buy-in tracking** — toggle Yes/No
  - If Yes: **Currency** picker — € / $ / £ / kr / pts (for chips)
  - When logging: each player enters buy-in amount and optional re-buys; cash-out entered at end; profit/loss calculated automatically

### Step 5 — Confirm & create
- Preview card showing: icon, colour, name, description
- Summary rows: win type, win condition (if applicable), score fields (if any), players, buy-in status
- Credit cost notice: **25 credits**
- "Create game" button

---

## 3. Data model changes

The current `GameTemplate` schema:
```prisma
model GameTemplate {
  id           String   @id @default(cuid())
  userId       String
  name         String
  description  String?
  scoringNotes String?
  createdAt    DateTime @default(now())
}
```

New fields to add:
```prisma
  color        String   @default("#f5a623")   // hex colour
  icon         String   @default("🎲")        // emoji icon
  winType      String                          // see §2 win type IDs
  winCondition String?                         // "high" | "low" | null
  scoreFields  String[] @default([])           // ordered list of field names
  roles        String[] @default([])           // role names (winner/secret-mission)
  missions     String[] @default([])           // mission names (secret-mission)
  trackDifficulty Boolean @default(false)      // cooperative
  trackTeamScores Boolean @default(false)      // team
  timeUnit     String?                         // "seconds" | "minutes" | "mmss"
  buyInEnabled Boolean  @default(false)
  buyInCurrency String?                        // "€" | "$" | "£" | "kr" | "pts"
  scoringNotes String?                         // kept for rules reminder
```

Migration: existing templates get `winType = "points-all"`, `winCondition = "high"`, `color = "#f5a623"`, `icon = "🎲"`.

---

## 4. Win type IDs reference

| ID | Label |
|---|---|
| `points-all` | Points — All players |
| `points-winner` | Points — Winner only |
| `time` | Time |
| `ranking` | Ranking |
| `elimination` | Elimination |
| `winner` | Winner declaration |
| `cooperative` | Cooperative |
| `team` | Team vs Team |
| `secret-mission` | Secret Mission |

---

## 5. Session logging impact

The session logger (played games) reads the game template's win type and fields to render the correct input UI. This spec does not redesign the logger — that is deferred to Phase 3. The new template fields are stored now so Phase 3 can use them.

---

## 6. Credit cost

Creating a game template costs **25 credits** — unchanged from current implementation.

---

## 7. Curated assets

**20 colours:**
`#e74c3c` `#e67e22` `#f5a623` `#f1c40f` `#2ecc71` `#1abc9c` `#3498db` `#2980b9` `#9b59b6` `#8e44ad` `#e91e63` `#ff5722` `#795548` `#607d8b` `#34495e` `#16a085` `#27ae60` `#d35400` `#c0392b` `#7f8c8d`

**30 icons:**
🎲 🏆 ⚔️ 🛡️ 👑 ⭐ 🗺️ 🔮 🎯 🧩 🃏 ♟️ 🎭 🔑 💎 🏹 🧙 🐉 🌍 🎪 🚀 ⚓ 🌊 🔥 ❄️ 🌙 ☀️ 🎸 🎺 🎻

---

## 8. Landing page — Game Types section

A new section on the marketing landing page showcases the 9 win types as a "works for any kind of game" feature highlight.

### Placement
Between the existing "Core Features" section and "How It Works" — or after "How It Works". To be confirmed during implementation.

### Content
- Section overline: e.g. "Every game type"
- Section headline: e.g. "Built for the games you actually play"
- Short subheadline: one sentence positioning Dice Vault as flexible
- 9 cards (or tiles), one per win type, each showing:
  - An emoji icon (from the curated 30-icon set in §7)
  - A short label (plain-language name, not the internal ID)
  - One sentence describing what kind of game fits this type

### Win type display names & icons

| ID | Display name | Icon |
|---|---|---|
| `points-all` | Points | 🎲 |
| `points-winner` | High score | 🏆 |
| `time` | Fastest wins | ⏱ |
| `ranking` | Finish order | 🥇 |
| `elimination` | Last one standing | ⚔️ |
| `winner` | Winner declared | 👑 |
| `cooperative` | Co-op | 🛡️ |
| `team` | Team vs Team | ⚔️ |
| `secret-mission` | Secret mission | 🔮 |

### Layout
- Grid: 3 columns on desktop, 2 on tablet, 1 on mobile (or 3-3-3 if 9 cards)
- Cards match the existing landing page card style (`#141820` bg, amber border at 8% opacity)
- Emoji displayed large (e.g. 28–32px), title below, description below that

### i18n
Strings added to `messages/en/landing.json` and `messages/nl/landing.json` under a new `gameTypes` key.

---

## 9. Out of scope (this phase)

- Session logger UI updates (Phase 3)
- Feedback form for missing win types (later phase)
- Image/photo upload for game cover
- BGG (BoardGameGeek) integration
- Admin-level game template library (shared templates)
