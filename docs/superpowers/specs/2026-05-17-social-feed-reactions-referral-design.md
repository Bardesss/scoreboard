# Dice Vault — Social Feed, Reactions, Referral, Public Profile, Family Credits Design
*Date: 2026-05-17*

---

## Overview

Dice Vault has the social *pipes* (vault connections, player linking, borrowed leagues, played-game approvals, share links, notifications) but no social *layer* on top. Nothing pulls users back between game nights, nothing converts a satisfied user into an inviter of new users, and there's no construct for a parent who wants their kids to play without buying separate credit balances.

This spec adds five interlocking features that target both engagement (more games logged → more credits consumed) and acquisition (referred users → new credit-paying customers):

1. **Activity feed** — personal stream of recent games from leagues you're in, rendered as rich "scorecards."
2. **Reactions** — five fixed emoji you can toggle on any approved played game in a league you share.
3. **Referral attribution** — opportunistic; rides on the existing QR connect-token and game share-token URLs, not a separate invite-code system. Both inviter and invitee receive +10 permanent credits when invitee logs their first approved game.
4. **Public profile** at `/u/[username]` — opt-in, three-state privacy (`private` / `stats` / `full`).
5. **Family shared credits** — a household construct where 1–2 parents and N children share a single credit pool, with parents controlling purchases and a +25%-per-member monthly bonus.

The credit-driving thesis: feed FOMO + reaction dopamine drive existing users to log more sessions (each at 5 credits); referral attribution funnels new users in, each starting with a 10-credit nudge to log their first game; family pools concentrate household credit spend onto one paying account.

---

## 1. Implementation plans

Everything in this spec ships in a single design pass, but the implementation is split into **three plans** grouped by feature coherence so each plan can be reviewed and shipped independently.

| Plan | Scope |
|---|---|
| **Plan 1 — Engagement** | Reaction schema, `Scorecard` component, personal feed on `/app/profile`, reactions backend + UI, two new notification types (`connection_game_logged`, `reaction_received`) with batching, compact-row reaction count badge on existing `PaginatedGamesTable`. |
| **Plan 2 — Acquisition** | Referral schema + anti-abuse fields, signal capture at signup, email normalization, risk scoring at payout, credit-bonus payout hook on first approved game, welcome banner + toast + referrer notification, `/u/[username]` public profile renderer, privacy settings UI in `/app/settings`, anonymization of opponents per `allowAppearInOthers`. |
| **Plan 3 — Family shared credits** | `Family` + `FamilyMember` schema, parent invite flow (existing-user invite via QR/shareable-link, like the existing connect-token pattern), child-account creation flow, shared pool semantics, +25%/member monthly cron adjustment, parent purchase routing, child purchase block, `/app/family` parent dashboard, family pool surfaced in `/app/credits`. |

The three plans are mostly independent: Plan 1 and Plan 2 share the schema migration but not much else. Plan 3 is self-contained except where it touches game-logging credit deduction (which Plan 2 also touches lightly for referral payout).

---

## 2. Data model

All schema changes are **additive**. No destructive migrations.

### User additions

```prisma
model User {
  // existing fields preserved...

  // Referral attribution (Plan 2)
  referredByUserId    String?
  referredBy          User?    @relation("Referrer", fields: [referredByUserId], references: [id], onDelete: SetNull)
  referrals           User[]   @relation("Referrer")
  referralBonusPaid   Boolean  @default(false)

  // Anti-abuse signals (Plan 2)
  signupIp            String?   // captured at user creation, hashed
  emailNormalized     String?   // lowercased local-part with `+suffix` and Gmail `.` stripped, then domain. Unique-indexed.
  lastSeenIp          String?   // updated on each authenticated request (hashed), used for collusion signals at payout time
  lastSeenAt          DateTime?
  referralFlags       Json?     // structured admin signals, see section 7.1

  // Privacy (Plan 2)
  publicProfileMode   String   @default("private")  // 'private' | 'stats' | 'full'
  allowAppearInOthers Boolean  @default(false)

  // Family membership (Plan 3) — back-relation; see Family / FamilyMember models in §6.5
  familyMember        FamilyMember?
}
```

- `referredByUserId` uses `onDelete: SetNull` — if the referrer deletes their account before payout, the invitee can still receive their +10 (the referrer's +10 is skipped).
- `publicProfileMode` is a string (not an enum) for migration simplicity and easy admin-settings extension later.
- `username` already exists on `User` and is `@unique` — usable for `/u/[username]` routing without changes.

### New model: PlayedGameReaction

```prisma
model PlayedGameReaction {
  id            String     @id @default(cuid())
  playedGameId  String
  playedGame    PlayedGame @relation(fields: [playedGameId], references: [id], onDelete: Cascade)
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  emoji         String
  createdAt     DateTime   @default(now())

  @@unique([playedGameId, userId, emoji])
  @@index([playedGameId])
  @@index([userId])
}
```

The unique constraint enforces toggleability: a user can react with each emoji at most once per game. Tapping the same emoji again deletes the row.

### No new "feed" table

The feed is a query, not a stored stream. The personal feed query:

```sql
SELECT pg.* FROM PlayedGame pg
JOIN League l ON pg.leagueId = l.id
WHERE pg.status = 'approved'
  AND (
    l.ownerId = :me
    OR EXISTS (
      SELECT 1 FROM LeagueMember lm
      JOIN Player p ON lm.playerId = p.id
      WHERE lm.leagueId = l.id AND p.userId = :me
    )
  )
ORDER BY pg.playedAt DESC
LIMIT :n OFFSET :m
```

Public profile feed query is the same scoped to the profile owner instead of the viewer. Both reuse the existing `loadGames` pattern (paginated, indexed on `playedAt`).

### Reaction set

A single source-of-truth lives in `src/lib/reactions.ts`:

```ts
export const ALLOWED_REACTIONS = ['🔥', '👏', '🎲', '😅', '💪'] as const
export type Reaction = typeof ALLOWED_REACTIONS[number]
```

Validated app-side in every action; no DB CHECK constraint (easier to evolve).

---

## 3. Surfaces & UX

### 3.1 Scorecard component (`src/components/social/Scorecard.tsx`)

The canonical "one played game" component for feed surfaces. **Not** used on the dashboard or league detail — those keep their existing compact `PaginatedGamesTable` rows and gain only a small reaction-count badge (see 3.5).

Visual:
- Card chrome: `bg: #fefcf8`, `border: 1px solid rgba(245,166,35,0.08)`, `boxShadow: 0 2px 16px rgba(30,26,20,0.07)`, `borderRadius: 16` — matches existing stat panels.
- Decorative **tear-line** at the top: a row of small amber dots (`rgba(245,166,35,0.35)`, 3px diameter, 6px spacing). Subtle "scorecard from a shoebox" texture.
- Header row: 28px game-template icon tile (template's color at 0.18 alpha) · game name (`font-headline font-bold 13px`) · league name (`text-on-surface-variant 11px`) · relative time (right-aligned, `11px #9a8c7a`).
- Score block: winner first, in `font-headline font-black 18px #f5a623`; remaining finishers in descending score order, body weight `#1e1a14`. All scores in a single list — no divider treatment (the existing `RankedListRow` rhythm carries the visual hierarchy via weight + color).
- Reaction strip footer: active emoji pills with counts (e.g. `🔥 3`), unfilled pills at 0.3 opacity. "+ react" button reveals a popover with the 5 allowed emojis.
- Anonymized rendering (public-profile context only): opponent player names render as `Speler A/B/C` when the opponent's `allowAppearInOthers = false`. The viewer's own name renders normally regardless.

Interaction:
- Tap a reaction pill → optimistic toggle, `+1` floating text animation (240ms, ease-out, fades), pill scale `1 → 1.12 → 1`. Server confirms; revert on failure.
- Tap an emoji's count → small popover lists the avatars + names of users who reacted.

### 3.2 Personal feed on `/app/profile`

Current state: profile page contains identity (name, email, language picker) + QR code + a few card sections. We restructure into two zones:

**Identity card** (top, compact):

```
╭─────────────────────────────────────────────╮
│  [avatar]   Bartus                          │
│             @bartus · since Apr 2026        │
│                                             │
│             ◉ Public (full)   🔗 QR  ⚙️    │
╰─────────────────────────────────────────────╯
```

- 44px avatar
- Username dominant (`font-headline font-black 18px`)
- Secondary line: handle + signup month
- Inline privacy state chip (clickable → routes to `/app/settings#privacy`) shows `Private` / `Public (stats)` / `Public (full)`. The user can see at a glance what others see.
- QR collapses from "always visible" to a 28px chip; tap to expand a sheet with the QR + share URL + copy button. Avoids the current "QR dominates the page" feel.

**Activity feed** (below):

```
Recent activity                          [🗓 All time ▾]
[ scorecard 1 ]
[ scorecard 2 ]
[ scorecard 3 ]
[ Prev / Next ]
```

- Section heading + the existing `DateFilter` dropdown (already shared on dashboard / league stats — reused verbatim).
- Vertical stack of scorecards, paginated 10 per page using the same `PaginatedGamesTable` footer pattern.
- Empty state: existing `EmptyState` component with a dice icon and a "Log your first game" CTA pointing to the `LogGameLauncher`.

### 3.3 Public profile `/u/[username]` (Plan 2)

Distinct two-band layout, deliberately more "destination" than the rest of the authenticated app:

**Hero band** (amber, full-width inside the page wrapper):

```
╔══════════════════════════════════════════════╗
║                                              ║
║   [avatar-72px]   BARTUS                     ║
║                   @bartus · 47 games ·       ║
║                   31 wins · 65% wr           ║
║                                              ║
╚══════════════════════════════════════════════╝
```

- Background: linear gradient `#fff3d4 → #fff7d8`, with a slightly heavier dot-grid texture than the global body texture (`radial-gradient(rgba(245,166,35,0.12) 1px, transparent 1px); background-size: 24px 24px`).
- Avatar: 72px, with a 3px amber ring (`#f5a623`).
- Username: `font-headline font-black 38px tracking-[-0.03em]` with subtle `text-shadow: 0 0 36px rgba(245,166,35,0.3)` — the only place in the authenticated app where the marketing-scale headline is used. Deliberate.
- Stat ribbon: single line, `font-body 14px`, dot-separated.

**Trophy shelf** (3 cards in a row, below hero):

For each of the user's top 3 game templates by play count, a mini-card with:
- Top hairline accent strip in the template's color (4px tall)
- Icon + name
- Play count + win-rate

**Recent games block** (visible only when `publicProfileMode === 'full'`):

Same scorecard component as 3.1, with the anonymization rules from 3.1 applied per opponent.

**404 path** (when `publicProfileMode === 'private'` or username not found): generic "Profile not found" page. Do **not** distinguish "private" from "doesn't exist" — privacy by obscurity.

### 3.4 Privacy settings (Plan 2, in `/app/settings`)

A new section card "Profile & privacy" using the existing settings-section pattern. Three controls:

```
Profile & privacy ─────────────────────────────

  Public profile
  ──────────────────────────────────────────────
  Show your profile at dicevault.fun/u/{username}
  to anyone with the link.

                                       [ ◯ off ]

  ─ when enabled ────────────────────────────────
  What others can see:
    ◉  Stats only
    ◯  Stats + recent games

  Name in others' profiles
  ──────────────────────────────────────────────
  When an opponent makes their profile public, may
  your name appear in their recent games?

                                       [ ◯ off ]
```

- The sub-radio is rendered (dimmed) even when the master toggle is off so users see what they're getting.
- "Name in others' profiles" has its own explanation block because the semantics are non-obvious. Default is `false` so users opt in to being mentioned, not out.

### 3.5 Compact-row reaction badge

The dashboard's `PaginatedGamesTable` (variant `compact`) and any other compact game-row surface gains a small reaction summary on the right side of each row:

```
... [game info] ...   🔥 3 · 👏 1    [W/L badge]
```

- Reaction summary is read-only here (cannot react from compact rows; clicking the badge routes to the scorecard for that game in the feed).
- Renders nothing when there are zero reactions.

### 3.6 Notification touchpoints

Two new notification types, added to the existing `Notification` system:

| Type | Icon | Color | Routes to | Email default |
|---|---|---|---|---|
| `connection_game_logged` | `Dices` | `#f5a623` | `/app/profile#game-{id}` | **OFF** |
| `reaction_received` | `Sparkles` | `#f5a623` | `/app/profile#game-{id}` | **OFF** |

Add to `iconFor` / `colorFor` / `hrefFor` switches in `NotificationsClient.tsx`. Add to `EmailPreferences` and `shouldSendEmailTo` helper.

Density mitigation for `connection_game_logged`:
- **Self-exclusion**: do not fire to game participants. Only to *other* league members.
- **In-app batching**: when the notification bell renders, group `connection_game_logged` notifications by `(leagueId, day)` and collapse into one row when count ≥ 2. Display as `"4 new games in {leagueName}"` with the same href as a single notification.
- Email default OFF (database default), opt-in via settings.

### 3.7 Referral attribution UX

The attribution itself is server-side and invisible. User-facing moments:

**(a) Welcome banner** — appears once on first authenticated load if `user.referralBonusPaid === false && user.referredByUserId != null`.

```
╭─ 🎁 Welcome! ──────────────────────────  × ╮
│  You and Bartus will each get +10 credits   │
│  when you log your first game.              │
╰─────────────────────────────────────────────╯
```

- Amber-chip palette (`primary-container #fff3d4` bg, `primary-dim #e09518` accent text).
- Dismissable via `×` — stores `localStorage.dvReferralBannerSeen = "1"` to prevent re-showing.

**(b) First-game bonus payout**:
- Toast on invitee's screen: `+10 credits — bonus for your first game` (uses existing `sonner` setup, success variant).
- Notification + email to referrer (new type `referral_bonus_earned`): *"{name} logged their first game. You both received +10 credits."*

**(c) Bragging chip on identity card**:

If `user.referrals.length > 0`, the identity card shows a small chip below the username:

```
🎁 3 friends invited
```

Tap to open a small modal listing the referred users (username only — no emails). Quiet flex.

---

## 4. Backend actions & APIs

### 4.1 Reaction toggle

**File:** `src/app/app/social/actions.ts` (new file; namespacing social-feature actions away from the existing per-page action files)

```ts
'use server'
export async function toggleReaction(playedGameId: string, emoji: string): Promise<
  | { reactions: Array<{ emoji: string; count: number; mine: boolean }> }
  | { error: 'notFound' | 'notAllowed' | 'invalidEmoji' | 'rateLimited' }
>
```

Authorization rules:
- Session required.
- `ALLOWED_REACTIONS.includes(emoji)` or return `invalidEmoji`.
- Caller must be a league member or owner of `playedGame.league`. Return `notAllowed` otherwise.
- `playedGame.status === 'approved'`. Return `notFound` otherwise (don't leak existence of pending games).
- Per-user per-game per-emoji rate-limit: 1 action per 500ms (in-memory or Redis bucket; Redis is already in the stack — use it).

Side effect: if creating (not deleting) and `playedGame.scores.some(s => s.player.userId === me) === false` (i.e., the reactor wasn't a participant), fire a `reaction_received` notification to each participant of the game.

### 4.2 Feed query

**File:** `src/lib/social/loadFeed.ts` (new)

```ts
export async function loadPersonalFeed(
  userId: string,
  page: number,
  perPage: number = 10
): Promise<FeedPage>

export async function loadPublicFeed(
  profileOwnerId: string,
  page: number,
  perPage: number = 10
): Promise<FeedPage>  // applies anonymization
```

Returns the played games with includes for `scores.player`, `league.gameTemplate`, and a denormalized `reactions: { emoji, count, mine? }[]`. The `mine` flag is set only when a viewer is known (personal feed); the public feed query takes an optional `viewerId` for the same purpose.

### 4.3 Referral attribution

Three integration points:

**(a) Connect-token registration** (`src/app/[locale]/connect/[token]/actions.ts`):

Modify `startConnectRegister` to attach `referredByUserId: target.id` on user creation. Existing connect logic continues (bidirectional VaultConnection, etc.).

**(b) Share-token registration** (`src/app/share/[token]/...`):

The share-token currently doesn't have a register flow — it's a read-only public game page. Plan 2 adds:
- A `Sign up to log your own games` CTA on the share page (visible when unauthenticated).
- On click → `/en/auth/register?ref=<game.league.ownerId>` (or similar — exact param shape TBD in implementation).
- Register flow honors `ref` query param the same way `connect-token` honors the token: stores `referredByUserId` on user creation.

**(c) First-game bonus payout** (server-side hook on game approval):

In the played-game approval flow (`approvePlayedGame` and direct-submission paths for owner-logged games), after a game transitions to `approved`:

```ts
async function maybePayoutReferralBonus(approvedGame: PlayedGame) {
  // Identify the user who logged this game (the game's submittedBy or the league owner if no submitter)
  const submitterUserId = approvedGame.submittedByUserId ?? approvedGame.league.ownerId
  const submitter = await prisma.user.findUnique({ where: { id: submitterUserId } })
  if (!submitter?.referredByUserId || submitter.referralBonusPaid) return
  if (!isThisTheirFirstApprovedGame(submitterUserId)) return  // existence check via `count > 0` excluding the one we just created
  
  await prisma.$transaction([
    prisma.user.update({ where: { id: submitterUserId }, data: { 
      permanentCredits: { increment: 10 }, 
      referralBonusPaid: true 
    } }),
    prisma.user.update({ where: { id: submitter.referredByUserId }, data: { 
      permanentCredits: { increment: 10 } 
    } }),
    // CreditTransaction rows for both, reason: 'referral_bonus'
  ])
  
  // notify both, email both per their preferences
}
```

Key edge: payout is on *approval*, not submission. A user submitting a game to a borrowed league (status `pending`) does not trigger payout — only when the league owner approves. This prevents the "create account, log junk, harvest credits" griefing path.

Edge: if the referrer was deleted (`referredByUserId === null` via `onDelete: SetNull`), the submitter still receives their +10; the referrer leg is silently skipped.

### 4.4 Privacy enforcement

**File:** `src/lib/social/privacy.ts` (new)

Pure functions:

```ts
export function canViewPublicProfile(profile: { publicProfileMode: string }): boolean
export function shouldRenderGames(profile: { publicProfileMode: string }): boolean  // 'full' only
export function anonymizeName(viewer: 'public', subject: { allowAppearInOthers: boolean; name: string }): string
```

Applied in:
- `src/app/[locale]/u/[username]/page.tsx` (Plan 2): early 404 if `publicProfileMode === 'private'`.
- `loadPublicFeed` (Plan 2): maps over score entries and replaces names per `allowAppearInOthers` of each player's linked user.

---

## 5. Translation keys

All new copy is i18n'd. New keys under `app.social.*`:

```json
{
  "social": {
    "feedHeading": "Recente activiteit",
    "feedEmpty": "Nog niets gelogd. Log je eerste partij om te beginnen.",
    "reactionTooltipReact": "Reageer",
    "reactionTooltipUnreact": "Verwijder reactie",
    "reactionWhoReacted": "Wie reageerde",
    "scorecardTimeAgo": "{when}",
    "compactRowReactionsAria": "{count} reacties",
    "referralBannerTitle": "Welkom!",
    "referralBannerBody": "Jij en {name} krijgen elk +10 credits zodra je je eerste partij logt.",
    "referralBonusToast": "+10 credits — bonus voor je eerste partij",
    "referralPayoutNotificationBody": "{name} heeft hun eerste partij gelogd. Jullie krijgen allebei +10 credits.",
    "identityChipReferralsCount": "{count, plural, =1 {1 vriend uitgenodigd} other {{count} vrienden uitgenodigd}}",
    "publicProfileSectionHeading": "Profiel & privacy",
    "publicProfileMasterToggle": "Openbaar profiel",
    "publicProfileMasterBody": "Toon je profiel op dicevault.fun/u/{username} aan iedereen met de link.",
    "publicProfileModeStats": "Alleen statistieken",
    "publicProfileModeFull": "Statistieken + recente partijen",
    "appearInOthersToggle": "Mijn naam in andermans profielen",
    "appearInOthersBody": "Als een tegenstander zijn profiel openbaar maakt, mag jouw naam dan getoond worden in zijn recente partijen?",
    "publicProfileNotFoundTitle": "Profiel niet gevonden",
    "publicProfileNotFoundBody": "Deze gebruiker bestaat niet of heeft een privéprofiel.",
    "publicProfileAnonymousLabel": "Speler {letter}",
    "trophyShelfHeading": "Trofeeën",
    "publicGamesHeading": "Recente partijen"
  }
}
```

English equivalents mirror the structure. The `referralPayoutNotificationBody` follows the existing `Notification` system's body-rendering convention.

---

## 6. Privacy edge cases

| Scenario | Behavior |
|---|---|
| Profile `full`, lists a game with Bartus; Bartus has `allowAppearInOthers = false`. | Game shown; Bartus rendered as "Speler B". Scores visible. |
| Profile set to `private`, then `full` again later. | Same URL works again. No redirect logic; no cache invalidation. |
| User changes username. | Old `/u/[username]` 404s. No redirect (intentional — username changes are rare, 404 is honest). |
| Account deletion. | All `PlayedGameReaction` rows cascade-delete (FK `onDelete: Cascade`). Username freed. `referredByUserId` of any users this user referred becomes NULL. |
| Anonymous browser hits `/u/private-user`. | Generic 404. Do not reveal existence. |
| Referrer deletes account before bonus payout. | `referredByUserId` becomes NULL. Invitee still gets their +10. Referrer leg skipped. |
| Reaction created, then league member is removed from the league. | Existing reactions remain (historical). New reactions blocked because authorization re-checks league membership at action time. |
| Game is rejected (approved → rejected via admin path). | Existing reactions stay (referenced game still exists). Card no longer surfaces in feeds because the query filters `status = 'approved'`. |

---

## 6.5 Family shared credits (Plan 3)

A household construct that lets one or two parents and N children share a single credit pool. The credit-economy thesis: parents who would otherwise see their kids drift away from logging (because each kid needs their own purchased credits) instead concentrate all household spend onto one paying account, with a small monthly bonus that thanks them for the consolidation.

### Family structure

| Role | Count | Capability |
|---|---|---|
| Parent | 1 (creator) to 2 max | Can buy credits, invite/remove members, see full family activity, manage family settings |
| Child | 0 to N (soft cap 5; see §7.1 caps) | Can log games (debits family pool), see own activity, **cannot** purchase credits |

The creator of the family becomes parent #1 automatically. A second parent can be promoted from a child member or invited as a parent directly.

### Schema

```prisma
model Family {
  id                String         @id @default(cuid())
  name              String?
  monthlyCredits    Int            @default(0)   // family-pool monthly credits (resets per cron)
  permanentCredits  Int            @default(0)   // family-pool permanent credits (from purchases, referrals if applicable, never reset)
  createdAt         DateTime       @default(now())
  members           FamilyMember[]
  creditTransactions CreditTransaction[]         // see below: tx rows can reference Family OR User
}

model FamilyMember {
  id        String   @id @default(cuid())
  familyId  String
  family    Family   @relation(fields: [familyId], references: [id], onDelete: Cascade)
  userId    String   @unique  // a user can only be in one family at a time
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      String   // 'parent' | 'child'
  joinedAt  DateTime @default(now())

  @@index([familyId])
}
```

The `User.familyMember` back-relation provides convenient access from a session-user lookup. `User.credits` fields are not removed — they stay frozen for members and resume on leaving.

The existing `CreditTransaction` model gains an optional `familyId` FK so credit transactions can be attributed to the family pool rather than a user. When non-null, `userId` continues to identify which member triggered the spend (for visibility in `/app/family`).

```prisma
model CreditTransaction {
  // existing fields...
  familyId  String?
  family    Family? @relation(fields: [familyId], references: [id], onDelete: SetNull)
}
```

### Family creation

`/app/family/new` (or a "Create family" CTA on `/app/credits` and `/app/profile`):

1. User clicks "Start a family"
2. Inline form: optional family name (default: "{User's name}'s family")
3. Server action `createFamily()`:
   - Creates `Family` row with the user as parent
   - Migrates the user's current `permanentCredits` into the family wallet (one-way — user's permanent is now 0, family's permanent has those credits)
   - User's `monthlyCredits` stays where it is until next monthly cron; from next cron onward, allocations go to family wallet
4. Redirects to `/app/family`

This migration of permanent credits at creation makes the transition clean: the parent doesn't "lose" credits, they just move them into the shared wallet they control. Reversible (see "Disbanding a family").

### Member invite flows

Two paths, both reusing existing share-token / QR infrastructure:

**(a) Invite existing user (adult parent or existing child user)**

Reuses the same pattern as `ConnectionRequest` but with type `family_invite`:

- Parent searches `/app/family → "Add member"` for an existing username/email.
- Server creates a `ConnectionRequest` row with `context: 'family_parent'` or `context: 'family_child'` (extending the existing `context` field — currently 'player_list' etc.).
- Recipient sees notification (`family_invite`), accepts via `/app/notifications`.
- On accept: `FamilyMember` row created with `role` matching the requested context.

For the **QR/share-link** variant: parent can generate a family-invite QR (separate from the existing connect-token QR — uses its own short-lived token type). Scanning it routes to `/family/invite/[token]` which behaves identically to the connect-token flow but creates a family-membership instead of (or in addition to) a vault connection.

**(b) Create child account from scratch**

For young kids who don't have their own email/account:

- Parent on `/app/family → "Add a child"` fills:
  - Display name (required)
  - Birthdate (optional, used only for age-appropriate UI hints — see "Anti-abuse for families")
  - Username for the child (required; must be unique)
  - Password (parent sets initial password; child can change later)
  - Email: optional — if provided, child can recover their own password; if empty, only parent can reset (admin tool or "parent can issue a new password" flow on `/app/family`)
- Server creates a new `User` row with:
  - `emailVerified` = creation time (no verification needed — parent vouches)
  - `referredByUserId` = null (child creation does not pay out the referral bonus; that would be a self-referral)
  - `familyMember` linked immediately with `role: 'child'`
  - Password hashed normally
- Child can now log in at the standard `/auth/login` with their username + password

Both flows respect the family-size cap (max 2 parents + N children, with N soft-capped at 5 — adjustable later).

### Pool semantics

While a user is in a family:

| Action | Effect |
|---|---|
| Log a game (5 credit cost) | Deducts from `Family.monthlyCredits` first, then `Family.permanentCredits`. Same logic as the existing User-level deduction, just on the family wallet. |
| Monthly cron fires | For each `FamilyMember`, contribute `(baseMonthlyAmount * 1.25)` to `Family.monthlyCredits`. Member's own `User.monthlyCredits` is **not** touched. |
| Purchase credits | Only parents (`role: 'parent'`) can initiate. Purchased credits land in `Family.permanentCredits`. Children attempting to access the purchase flow see a friendly "Ask {parent name} to top up the family pool" message. |
| Receive a referral bonus (via `referredByUserId`) | Paid into the receiver's `User.permanentCredits`. This is by design — referral attribution is per-user, not per-family, so children who got referred before joining a family keep their own bonus and bring it in if/when they leave. |
| Receive admin credit adjustment | Admin can target either `User.permanentCredits` (the individual) or `Family.permanentCredits` (the pool). Default UI on `/admin/credits` will gain a "Apply to family pool" toggle when the target user is in a family. |

When pool is empty: hard stop. Any family member attempting to log a game sees "Family pool is empty — {parent name} needs to top up." No fallback to personal credits (kept simple, as discussed).

### Leaving a family

Two paths: voluntary leave (member-initiated) or parent removal (admin-initiated within the family).

| Path | Behavior |
|---|---|
| Member leaves voluntarily | `FamilyMember` row deleted. Member's `User.monthlyCredits` resumes accruing on next cron. Their `User.permanentCredits` resumes being relevant. The family wallet is untouched — credits stay with the family. |
| Parent removes a child | Same as above; family wallet keeps its credits. |
| Last parent leaves | If only one parent remains, they must designate a new parent or disband first. If the lone parent leaves with children still present, the family is auto-disbanded (see below). |
| Family disbanded | All members released. `Family.permanentCredits` is transferred to whoever was the disbander (acknowledged in UI: "Your family's 47 remaining credits have been moved to your personal balance"). `Family.monthlyCredits` is forfeit (it was a perk of being in a family). Family row is soft-deleted (kept for credit-transaction history). |

### `/app/family` parent dashboard

Visible only to parents:

```
Family ─────────────────────────────────────── ⚙ Manage

Pool: 173 credits  (47 monthly · 126 permanent)        [+ Top up]

Members (3) ──────────────────────────────────  + Add member
  [avatar] Bartus (you) · parent           ───
  [avatar] Anna · parent · since 3 days ago ───
  [avatar] Tim · child · since 12 days ago ───
  [avatar] Eva · child · since 12 days ago ───

Recent family activity ──────────────────────  
  [scorecard] Risk in Sundays · Tim won · 2h ago    5 cr
  [scorecard] Catan in Vrijdag · Eva 4th · 1d ago   5 cr
  ...
```

- Members list shows role, join date, recent-activity count, and (for children) per-month credit usage.
- Tapping a member opens a detail sheet with usage breakdown and "Remove from family" (parents only).
- Recent activity is the union of all members' approved games, descending by `playedAt`.

### `/app/credits` for family members

- Parents: balance shows the family pool prominently; existing "buy credits" CTA continues to work (purchases route into the family wallet).
- Children: balance shows the family pool with a "Managed by {parent name}" label; buy CTA is replaced with a passive "Family credits are managed by {parent name}" note.

### Recap on the family monthly bonus

Each `FamilyMember` contributes `baseMonthlyAmount × 1.25` to `Family.monthlyCredits` at each monthly cron tick. So:

- Solo user: 50 credits/month (existing baseline; verify exact number)
- Family of 2: 2 × (50 × 1.25) = 125 credits/month
- Family of 4: 4 × 62.5 = 250 credits/month
- Family of 6 (cap): 6 × 62.5 = 375 credits/month

This is a 25% premium per member vs. solo accrual. The economic rationale: a family of 4 would otherwise accumulate 4 × 50 = 200 credits/month of personal allowance, only meaningful if each member separately logs and would otherwise let unused credits expire. The pool consolidates the unused-by-individuals slack into a usable bucket and adds 25% on top as a thank-you for consolidating spend onto one payer.

### Anti-abuse for families

Families are a new abuse vector (fake "families" of unrelated adults harvesting +25%/member). Apply the same signals as referral anti-abuse (§7.1):

- **At family creation**: capture parent's `signupIp` / `lastSeenIp`. No action yet.
- **At member-add time**: compute risk signals between the inviting parent and the invited member (or for child-account creation, between the parent and the new account's `signupIp` — which is the parent's own IP).
  - For child accounts created from parent's IP: this is *expected*, no flag.
  - For adult-invite where the invitee's `signupIp` differs from any existing parent's `signupIp` AND fuzzy-email doesn't match: CLEAN.
  - For adult-invite where the invitee's `lastSeenIp` matches the parent's `lastSeenIp` but `signupIp` differs: LOW (probably playing together IRL).
  - For adult-invite where the invitee's `signupIp` == parent's `signupIp` AND emails fuzzy-match: HIGH (likely same person).
- **Policy**: HIGH-flagged family additions block, with a notice to the parent: "We couldn't add this member automatically — contact support."
- **Family size hard cap**: 6 total members enforced server-side regardless of role.
- **Per-IP family cap**: at most 1 family ever created from a given `signupIp` (admin can override for genuine cases — e.g., legitimate large households sharing one router).

### Translation keys (additions)

```json
{
  "family": {
    "sectionHeading": "Familie",
    "createCta": "Familie starten",
    "membersHeading": "Familieleden",
    "addMember": "Lid toevoegen",
    "inviteAdult": "Bestaande gebruiker uitnodigen",
    "createChild": "Kind account aanmaken",
    "poolBalance": "Pool: {n} credits",
    "poolBreakdown": "{monthly} maandelijks · {permanent} permanent",
    "managedBy": "Beheerd door {name}",
    "topUp": "Aanvullen",
    "buyBlockedChild": "Familiecredits worden beheerd door {name}",
    "memberLeaveConfirm": "Weet je zeker dat je {name} uit de familie wilt halen?",
    "disbandConfirm": "Familie ontbinden? Resterende credits gaan naar jou.",
    "poolEmpty": "Familie-pool is leeg — vraag {name} om aan te vullen.",
    "familyInviteTitle": "{name} nodigt je uit voor hun familie",
    "familyInviteBody": "Accepteer om credits te delen.",
    "familyInviteAccepted": "Welkom bij de familie van {name}!",
    "addChildNameLabel": "Naam",
    "addChildUsernameLabel": "Gebruikersnaam",
    "addChildPasswordLabel": "Wachtwoord (kind kan dit later wijzigen)",
    "addChildEmailLabel": "E-mail (optioneel)",
    "familySizeCapReached": "Maximum aantal leden bereikt"
  }
}
```

English mirrors.

---

## 7. Credit-math sanity

Current economy (verify from `AdminSettings`):
- Monthly free credits: 50 (assumed — to be verified against `monthly_free_credits` setting)
- Cost per game logged: 5

Net effect:
- New referred user starts with monthly allocation + 10 referral bonus = ~60 credits = 12 games their first month. Generous, intentional — get them hooked into the logging habit before any paywall friction.
- Referrer earns +10 per successful invite. Stacks across invites. Naturally capped: each invitee can only trigger the bonus once.

Built-in passive safeguards:
- Bonus on *approved* game only — pending submissions to borrowed leagues don't pay out until the league owner approves.
- Bonus credits land in **permanent** credits (no monthly reset) so they can't accumulate by abusing the monthly cycle.
- Each user record can be the *invitee* of at most one referrer (one `referredByUserId` per user, set once at signup, never overwritten).

Active anti-abuse mechanisms are detailed in §7.1.

### 7.1 Anti-abuse

Referral mechanics get abused if you don't design for it. We accept some friction at the edges to reduce abuse, with the bias toward "let the genuine inviter through, flag the suspect one for admin review" rather than "block aggressively and hope."

#### Threat model

| Attack | Likelihood | Damage per instance |
|---|---|---|
| Self-referral (one person creates two accounts to harvest +20 credits = 4 games) | High | Low ($-equivalent of 4 games of credit) |
| Friend collusion (small group all referring each other to harvest tens of credits) | Medium | Low–Medium |
| Bulk farm (hundreds of disposable-email signups in a chain) | Low | High |
| Genuine referral mistakenly flagged | — | Loss of trust, support ticket |

We design for high-likelihood attacks first.

#### Signals captured

At user creation (`startConnectRegister`, `startConnectLogin → register`, normal `/auth/register`):

1. **`signupIp`** — SHA-256 of the request IP, salted with a static server secret (so the value isn't reversible back to an IP, but identical IPs hash to identical values for collusion detection). Stored on `User`.
2. **`emailNormalized`** — local-part lowercased, `+suffix` stripped, Gmail-style `.` separators removed (`john.doe+x@gmail.com` → `johndoe@gmail.com`). Stored on `User`, unique-indexed.
3. **`signupUserAgent`** — first 200 chars of the User-Agent header, captured in `referralFlags` for admin context.

On each authenticated request (via middleware extension):
4. **`lastSeenIp`** — same SHA-256 treatment, updated at most once per 15 min per user (cheap throttling via `User.lastSeenAt`).

#### Email normalization

A new helper `src/lib/email/normalize.ts`:

```ts
export function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split('@')
  const stripped = local.split('+')[0]
  const collapsed = domain === 'gmail.com' || domain === 'googlemail.com'
    ? stripped.replace(/\./g, '')
    : stripped
  return `${collapsed}@${domain}`
}
```

The signup flow:
- Computes `emailNormalized`
- Rejects signup if any existing user has the same `emailNormalized` (with a generic error — don't leak that the email is taken)
- This catches `john+1@gmail.com`, `john+2@gmail.com`, and `j.ohn@gmail.com` all aliasing to the same primary inbox.

#### Risk scoring at payout time

When the bonus would pay out (game approval), evaluate:

```ts
type Signal = 'CLEAN' | 'LOW' | 'MEDIUM' | 'HIGH'

function evaluateReferralRisk(invitee: User, referrer: User): { signal: Signal, reasons: string[] }
```

| Reason | Contribution |
|---|---|
| `invitee.signupIp === referrer.signupIp` (same machine ever) | HIGH |
| `invitee.emailNormalized` and `referrer.emailNormalized` have same root local-part (e.g., `johndoe` vs `john_doe`) — fuzzy match | HIGH |
| `invitee.signupIp === referrer.lastSeenIp` (registered from referrer's current IP) | HIGH |
| `invitee.lastSeenIp === referrer.lastSeenIp` (currently active on same IP) and `< 24h since invitee.createdAt` | MEDIUM |
| Same IP but `> 24h since invitee.createdAt` (i.e., they only colocate occasionally) | LOW |
| Disposable-email domain (small blocklist of common providers: mailinator.com, guerrillamail.com, etc.) | MEDIUM |

Composite: any HIGH = HIGH; two MEDIUMs = HIGH; one MEDIUM = MEDIUM; one or more LOW = LOW; none = CLEAN.

#### Payout policy

| Signal | Action |
|---|---|
| CLEAN | Pay both legs, no admin entry |
| LOW | Pay both legs, append to `referralFlags` on both users with reason for admin context (visible in admin panel only) |
| MEDIUM | Pay both legs, create an admin review entry — admin can reverse the bonus within 7 days if they confirm abuse |
| HIGH | Skip the referrer leg (invitee still gets their +10 — don't punish a possibly-genuine new user). Create an admin review entry. Set `referralBonusPaid = true` so the same chain doesn't replay. |

The invitee always gets their +10 unless the *invitee account itself* is flagged as suspended (out of scope here — basic account state is managed elsewhere). This bias is deliberate: a new user logging their first game is exactly the conversion event we want, even if the inviter turns out to be gaming the system.

#### Hard caps

- **Per referrer, rolling 30 days**: at most **5** successful CLEAN/LOW/MEDIUM payouts. The 6th invitee in a 30-day window still gets their +10; the referrer leg is silently skipped (an in-app notification to the referrer: *"You've reached this month's referral cap of 5. Your friend still got their bonus."*).
- **Per IP, lifetime**: at most **3** accounts can ever register from a single `signupIp`. The 4th and beyond signup proceeds but `referredByUserId` is forcibly NULL'd, with `referralFlags.reason = 'ip_cap_exceeded'`. (Edge: legit shared IPs like university dorms or family households are bounded — 3 covers most realistic cases.)

#### Admin surfacing

A new admin section under `/admin/referrals` (out of scope for the three plans here — admin-side follow-up — but designed-for in the schema):
- List of all payouts with their signal, reasons, and timestamps
- Filter: HIGH-flagged within last 30 days
- Action: reverse a payout (debits both users, sets `referralBonusPaid = false` so the invitee could in theory earn the bonus again with a different inviter; admin discretion)

This is the safety valve: design assumes most automated decisions are right but gives humans a clear path to fix the rest.

#### What we deliberately don't do

- **Phone verification**: too high friction for a game-night app, and SMS costs money.
- **CAPTCHAs at signup**: kills conversion. The bonus cap + IP cap already make farming uneconomical.
- **Hard block on disposable email**: the blocklist is impossible to maintain comprehensively. Treat disposable-email as a MEDIUM signal that combines with others, not an outright block.

---

## 8. Implementation grouping (3 plans)

The work below is grouped into three independently-shippable plans. Each plan ends with a copy update — Plan 3 (the last to ship) also handles a holistic landing-page + README sweep mentioning the full feature set.

### Plan 1 — Engagement

Schema, scorecard, feed, reactions, notifications.

| Step | Files touched |
|---|---|
| Prisma migration: `PlayedGameReaction` model + reaction-related User indexes (no User additions yet — those land with Plan 2 to keep the migration scope honest) | `prisma/schema.prisma`, new migration |
| `src/lib/reactions.ts` (allowed set constant) | new |
| `src/app/app/social/actions.ts` (`toggleReaction`) | new |
| `src/lib/social/loadFeed.ts` (`loadPersonalFeed`) | new |
| `src/components/social/Scorecard.tsx` | new |
| `/app/profile` restructure: identity card + feed | `src/app/app/profile/ProfileClient.tsx`, `page.tsx` |
| Compact-row reaction badge in `PaginatedGamesTable` | `src/components/stats/PaginatedGamesTable.tsx` |
| Two new notification types (`connection_game_logged`, `reaction_received`) + icon/color/route + email templates | `NotificationsClient.tsx`, `emailTemplates.ts`, `emailPreferences.ts` |
| Density: batching of `connection_game_logged` | `NotificationBell.tsx` rendering layer |
| Plan-1 landing/README copy update — feed + reactions section | `src/app/[locale]/(marketing)/page.tsx`, `README.md` |

### Plan 2 — Acquisition

Referral attribution, anti-abuse, public profile, privacy. Includes the User-table schema additions (`referredByUserId`, `referralBonusPaid`, anti-abuse fields, `publicProfileMode`, `allowAppearInOthers`) — one migration covers everything Plan 2 needs.

| Step | Files touched |
|---|---|
| Prisma migration: User additions for referral + anti-abuse + privacy | `prisma/schema.prisma`, new migration |
| `src/lib/email/normalize.ts` (email canonicalization) | new |
| `src/lib/social/referralRisk.ts` (signal scoring + payout policy) | new |
| Anti-abuse signal capture at signup (`signupIp`, `emailNormalized`, UA) | signup action paths |
| Anti-abuse: `lastSeenIp` middleware hook | `src/middleware.ts` |
| Referral attribution: connect-token registration | `src/app/[locale]/connect/[token]/actions.ts` |
| Referral attribution: share-token signup CTA + register-with-ref param | `src/app/share/[token]/page.tsx`, signup action |
| Referral payout hook on first approved game | hooked into every `status → 'approved'` transition path |
| Per-referrer 30-day cap + per-IP lifetime cap | enforced in payout hook |
| Welcome banner | new client component, mounted in `/app/layout.tsx` |
| Identity-card referrals chip ("3 friends invited") | `ProfileClient.tsx` |
| `/app/settings` Privacy section | `src/app/app/settings/sections/PrivacySection.tsx` (new) |
| `/u/[username]` page + 404 handling | `src/app/[locale]/u/[username]/page.tsx` (new) |
| `loadPublicFeed` with anonymization | `src/lib/social/loadFeed.ts` |
| Hero band + trophy shelf | `src/components/social/PublicProfileHero.tsx`, `TrophyShelf.tsx` (new) |
| Plan-2 landing/README copy update — referral + public profile section | `src/app/[locale]/(marketing)/page.tsx`, `README.md` |

### Plan 3 — Family shared credits

Self-contained except for credit-deduction-on-log integration.

| Step | Files touched |
|---|---|
| Prisma migration: `Family` + `FamilyMember` models + `CreditTransaction.familyId` field | `prisma/schema.prisma`, new migration |
| `src/lib/family/membership.ts` (member queries, role checks) | new |
| `src/app/app/family/actions.ts` (createFamily, addParent, addChild, removeMember, disband, acceptFamilyInvite) | new |
| Family-invite via existing `ConnectionRequest` (`context: 'family_*'`) | `src/app/app/connections/actions.ts` extension |
| Family-invite QR/share-link token type | new in `src/app/[locale]/family/invite/[token]/page.tsx` |
| Child-account creation flow (parent-managed credentials) | inside `family/actions.ts` |
| Anti-abuse signals at family-add time (reuse `referralRisk.ts` patterns) | extension of `referralRisk.ts` or sibling file |
| Modify game-logging credit deduction: route to `Family` wallet when user is a member | `src/app/app/leagues/[id]/log/actions.ts` (and wherever the existing deduction lives) |
| Monthly cron: +25%/member contribution to `Family.monthlyCredits` instead of `User.monthlyCredits` for members | the existing monthly-reset cron job |
| Block credit purchases for children; route parent purchases to family wallet | existing purchase action |
| `/app/family` parent dashboard (members list + pool + recent activity) | new |
| `/app/credits` family-aware rendering (pool view, child-locked buy CTA) | `CreditsClient.tsx` |
| Family-invite notification type | extend Notification system |
| Plan-3 landing/README copy update — family credits section; holistic sweep across landing & README mentioning all three plans' features (feed, reactions, referral, public profile, privacy, family) | `src/app/[locale]/(marketing)/page.tsx`, `README.md`, `docs/design-guidelines.md` (Shared components registry §13) |

---

## 9. Open questions deferred to implementation plan

- Exact rate-limit implementation for reactions (Redis bucket vs in-memory). Redis is already in the stack — likely Redis with TTL 1s and `INCR` check.
- Whether the dashboard's compact-row reaction badge should also surface on league-detail's game-history list. Probably yes; will be confirmed during implementation.
- Whether to add an admin-tunable `referral_bonus_amount` setting (currently hardcoded 10 per side). YAGNI for v1; revisit if tuning becomes needed.
- Whether `referral_bonus_earned` notification needs its own type or can piggyback on a generic `credit_change` notification. Stylistically the dedicated type makes the email warmer ("celebrate the friend") — designed as a dedicated type above.
- Whether to show the "1 friend invited" chip when count is 0 (i.e., hide vs show with empty state). Designed to hide when 0.
- Exact disposable-email blocklist (static vs admin-tunable). Initial: ~20 well-known providers hardcoded in `src/lib/email/disposable.ts`; promote to admin setting if it becomes an attack vector.
- Per-IP lifetime cap (3 accounts) — too aggressive for shared-household legitimate use? Ship at 3, monitor `referralFlags.reason = 'ip_cap_exceeded'` telemetry, tune if it bites genuine users.
- Where exactly the played-game approval transition is fired (`approvePlayedGame` is one path; owner-logged games may skip approval entirely and land as `approved` directly). Implementation plan needs to enumerate every code path that transitions `status → 'approved'` and wire the referral-payout hook into each.
- IP-hashing salt rotation policy. Initial: static server secret; if leaked, prior signals become non-comparable but going forward stays meaningful. Acceptable for v1.
- Family creation migrating `permanentCredits` into the family wallet — should this be opt-in (user explicitly clicks "Move my credits") or automatic (one-way at creation, as currently designed)? Automatic is simpler and the disband flow reverses it; might revisit if it surprises users.
- Family monthly bonus stacking with referral bonus — does a referred user who joins a family lose access to their +10 referral bonus? Designed as: referral payout goes to the user's `User.permanentCredits`, which is frozen-but-not-deleted while in a family. When they leave, the +10 returns to use. Effectively the bonus is "banked" until family membership ends. Confirm this is the desired behavior.
- Whether to allow a second parent to be invited from outside the family (i.e., adding a new adult straight as a parent), or whether second-parent promotion must come from an existing child member graduating. Current design allows both — confirm.

---

## 10. Success metrics (informational, not in scope to build)

- **Engagement**: average games logged per active user per month, before vs after MVP ships. Expected lift driven by feed FOMO + reaction dopamine.
- **Acquisition**: count of users with non-null `referredByUserId`. Conversion rate from sign-up to first-game-logged (referral bonus pays out only when this fires).
- **Credit consumption**: total credits spent on `played_game` reason, before vs after. Direct revenue proxy.
- **Notification health**: opt-out rate of `connection_game_logged` email type. Above ~30% suggests density mitigation isn't strong enough.
