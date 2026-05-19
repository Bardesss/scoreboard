# Dice Vault — Social Feed, Public Profile, Family Credits Design
*Date: 2026-05-17 (revised 2026-05-19)*

---

## Overview

Dice Vault has the social *pipes* (vault connections, player linking, borrowed leagues, played-game approvals, share links, notifications) but no social *layer* on top. There's nothing that pulls users back between game nights, and no construct for a parent who wants their kids to play without buying separate credit balances.

This spec adds three interlocking features:

1. **Activity feed** — personal stream of recent games from leagues you're in, rendered as rich "scorecards."
2. **Reactions** — five fixed emoji you can toggle on any approved played game in a league you share.
3. **Public profile** at `/u/[username]` — opt-in, three-state privacy (`private` / `stats` / `full`).
4. **Family shared credits** — a household construct where 1–2 parents and N children share a single credit pool, with parents controlling purchases and a fixed 150 cr/month accrual once the family has ≥2 members.

The thesis: feed FOMO + reaction dopamine drive existing users to log more sessions; the public profile gives users a destination they can share; family pools concentrate household credit spend onto one paying account.

> **Out of scope (cut from earlier revision):** referral attribution, signup signal capture (IP / UA hashing, email normalization), risk scoring, per-referrer + per-IP caps, welcome banner, referrer notifications. All cut. Family pool is also no longer per-member scaled and has no anti-abuse signals beyond a hard size cap.

---

## 1. Implementation plans

Three plans, each independently shippable.

| Plan | Scope |
|---|---|
| **Plan 1 — Engagement** | `PlayedGameReaction` schema, `Scorecard` component, personal feed on `/app/profile`, reactions backend + UI, two new notification types (`connection_game_logged`, `reaction_received`) with batching, compact-row reaction-count badge on existing `PaginatedGamesTable`. |
| **Plan 2 — Public Profile** | `publicProfileMode` + `allowAppearInOthers` on `User`, `/u/[username]` page (hero + trophy shelf + recent games), opponent anonymization, Privacy section in `/app/settings`. |
| **Plan 3 — Family shared credits** | `Family` + `FamilyMember` schema, parent invite flow (existing-user invite via `ConnectionRequest`, plus QR/share-link), child-account creation flow, shared pool semantics, flat 150 cr/month accrual when ≥2 members, parent purchase routing, child purchase block, `/app/family` parent dashboard, family pool surfaced in `/app/credits`, disband flow. |

Plan 1 and Plan 2 share no schema. Plan 3 is self-contained except where it touches game-logging credit deduction.

---

## 2. Data model

All schema changes are **additive**. No destructive migrations.

### User additions

```prisma
model User {
  // existing fields preserved...

  // Privacy (Plan 2)
  publicProfileMode   String   @default("private")  // 'private' | 'stats' | 'full'
  allowAppearInOthers Boolean  @default(false)

  // Family membership (Plan 3) — back-relation; see Family / FamilyMember models in §6
  familyMember        FamilyMember?
}
```

- `publicProfileMode` is a string (not an enum) for migration simplicity.
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

Public profile feed query is the same scoped to the profile owner instead of the viewer. Both reuse the existing `loadGames` pattern.

### Reaction set

Source of truth in `src/lib/reactions.ts`:

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
- Score block: winner first, in `font-headline font-black 18px #f5a623`; remaining finishers in descending score order, body weight `#1e1a14`. All scores in a single list — no divider treatment.
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
- Inline privacy state chip (clickable → routes to `/app/settings#privacy`) shows `Private` / `Public (stats)` / `Public (full)`.
- QR collapses from "always visible" to a 28px chip; tap to expand a sheet with the QR + share URL + copy button.

**Activity feed** (below):

```
Recent activity                          [🗓 All time ▾]
[ scorecard 1 ]
[ scorecard 2 ]
[ scorecard 3 ]
[ Prev / Next ]
```

- Section heading + the existing `DateFilter` dropdown (reused verbatim).
- Vertical stack of scorecards, paginated 10 per page using the same `PaginatedGamesTable` footer pattern.
- Empty state: existing `EmptyState` component with a dice icon and a "Log your first game" CTA pointing to the `LogGameLauncher`.

### 3.3 Public profile `/u/[username]` (Plan 2)

Distinct two-band layout, deliberately more "destination" than the rest of the authenticated app.

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

- Background: linear gradient `#fff3d4 → #fff7d8`, with a heavier dot-grid texture than the global body texture (`radial-gradient(rgba(245,166,35,0.12) 1px, transparent 1px); background-size: 24px 24px`).
- Avatar: 72px, with a 3px amber ring (`#f5a623`).
- Username: `font-headline font-black 38px tracking-[-0.03em]` with subtle `text-shadow: 0 0 36px rgba(245,166,35,0.3)`.
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
- "Name in others' profiles" has its own explanation block because the semantics are non-obvious. Default is `false` — opt in to being mentioned, not out.

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

---

## 4. Backend actions & APIs

### 4.1 Reaction toggle

**File:** `src/app/app/social/actions.ts` (new)

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
- Per-user per-game per-emoji rate-limit: 1 action per 500ms (Redis bucket via the existing ioredis client).

Side effect: if creating (not deleting) and the reactor wasn't a participant of the game, fire a `reaction_received` notification to each participant.

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
  perPage: number = 10,
  viewerId?: string
): Promise<FeedPage>  // applies anonymization
```

Returns the played games with includes for `scores.player`, `league.gameTemplate`, and a denormalized `reactions: { emoji, count, mine? }[]`. The `mine` flag is set only when a viewer is known.

### 4.3 Privacy enforcement

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

English equivalents mirror the structure. Family-specific keys appear in §6 below.

---

## 6. Family shared credits (Plan 3)

A household construct that lets one or two parents and N children share a single credit pool. Parents control purchases; the family pool replaces the per-member personal pool while a user is a member.

### 6.1 Family structure

| Role | Count | Capability |
|---|---|---|
| Parent | 1 (creator) to 2 max | Can buy credits, invite/remove members, see full family activity, manage family settings |
| Child | 0 to N (hard cap of 6 total members) | Can log games (debits family pool), see own activity, **cannot** purchase credits |

The creator of the family becomes parent #1 automatically. A second parent can be promoted from a child member or invited as a parent directly.

### 6.2 Schema

```prisma
model Family {
  id                String         @id @default(cuid())
  name              String?
  monthlyCredits    Int            @default(0)   // family-pool monthly credits (resets per cron)
  permanentCredits  Int            @default(0)   // family-pool permanent credits (from purchases, never reset)
  createdAt         DateTime       @default(now())
  members           FamilyMember[]
  creditTransactions CreditTransaction[]
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

The existing `CreditTransaction` model gains an optional `familyId` FK so credit transactions can be attributed to the family pool rather than a user. When non-null, `userId` continues to identify which member triggered the spend.

```prisma
model CreditTransaction {
  // existing fields...
  familyId  String?
  family    Family? @relation(fields: [familyId], references: [id], onDelete: SetNull)
}
```

### 6.3 Family creation

`/app/family/new` (or a "Create family" CTA on `/app/credits` and `/app/profile`):

1. User clicks "Start a family"
2. Inline form: optional family name (default: "{User's name}'s family")
3. Server action `createFamily()`:
   - Creates `Family` row with the user as parent
   - Migrates the user's current `permanentCredits` into the family wallet (one-way — user's permanent is now 0, family's permanent has those credits)
   - User's `monthlyCredits` stays where it is until next monthly cron; from next cron onward, allocations stop for this user (they get them via the family pool instead, once the family has ≥2 members)
4. Redirects to `/app/family`

Migrating permanent credits at creation makes the transition clean: the parent doesn't "lose" credits, they move them into the shared wallet they control. Reversible via disband (see §6.7).

### 6.4 Member invite flows

Two paths, both reusing existing share-token / QR infrastructure:

**(a) Invite existing user (adult parent or existing child user)**

Reuses the same pattern as `ConnectionRequest` with new context values:

- Parent searches `/app/family → "Add member"` for an existing username/email.
- Server creates a `ConnectionRequest` row with `context: 'family_parent'` or `context: 'family_child'` (extending the existing `context` field).
- Recipient sees notification (`family_invite`), accepts via `/app/notifications`.
- On accept: `FamilyMember` row created with `role` matching the requested context.

For the **QR/share-link** variant: parent can generate a family-invite QR (separate from the existing connect-token QR — uses its own short-lived token type). Scanning it routes to `/family/invite/[token]` which behaves identically to the connect-token flow but creates a family membership.

**(b) Create child account from scratch**

For young kids who don't have their own email/account:

- Parent on `/app/family → "Add a child"` fills:
  - Display name (required)
  - Username for the child (required; must be unique)
  - Password (parent sets initial password; child can change later)
  - Email: optional — if provided, child can recover their own password; if empty, only parent can reset
- Server creates a new `User` row with:
  - `emailVerified` = creation time (no verification needed — parent vouches)
  - `familyMember` linked immediately with `role: 'child'`
  - Password hashed normally
- Child can now log in at the standard `/auth/login` with their username + password

Both flows respect the family-size cap of 6 total members.

### 6.5 Pool semantics

While a user is in a family:

| Action | Effect |
|---|---|
| Log a game (5 credit cost) | Deducts from `Family.monthlyCredits` first, then `Family.permanentCredits`. Same logic as the existing User-level deduction, just on the family wallet. |
| Monthly cron fires | If the family has **≥2 members**, set `Family.monthlyCredits = 2 × monthly_free_credits` (currently 150; tracks the `monthly_free_credits` admin setting). If the family has 1 member, set to 0. Member's own `User.monthlyCredits` is **not** touched. |
| Purchase credits | Only parents (`role: 'parent'`) can initiate. Purchased credits land in `Family.permanentCredits`. Children attempting to access the purchase flow see "Family credits are managed by {parent name}". |
| Receive admin credit adjustment | Admin can target either `User.permanentCredits` (the individual, frozen) or `Family.permanentCredits` (the pool). `/admin/credits` gains an "Apply to family pool" toggle when the target user is in a family. |

When pool is empty: hard stop. Any family member attempting to log a game sees "Family pool is empty — {parent name} needs to top up." No fallback to personal credits.

**Note on the ≥2 rule:** a solo-parent family (newly created, no invites accepted yet) gets 0 cr/month from the cron. The moment a second member accepts, the *next* cron tick begins paying out 150/month. The bonus is not retroactive within a month.

### 6.6 Leaving / releasing a member

The same underlying operation (delete `FamilyMember` row, leave `User` row + all play history intact) has three entry points in the UI:

| Path | Initiator | UI label | Behavior |
|---|---|---|---|
| **Member leaves voluntarily** | the member, from `/app/family` | "Leave family" | `FamilyMember` row deleted. Member keeps their User account, all `PlayedGame` history, scores, reactions. Their `User.monthlyCredits` resumes accruing on next cron. Their `User.permanentCredits` resumes being relevant. Family wallet untouched. |
| **Parent removes a member** | a parent, from member detail sheet on `/app/family` | "Remove from family" | Same as above. Used for kids who left the household, members who shouldn't have been added, etc. |
| **Parent releases a child to independence** *(graduation)* | a parent, from member detail sheet on `/app/family` | "Release to own account" | Same underlying operation as remove. Distinct UI affordance + copy because the intent is different: the child is becoming an independent vault keeper, not being expelled. The child keeps their `User`, all play history, and gains their own monthly credit allowance from the next cron. |

The release/remove and voluntary-leave paths all preserve:
- The `User` row itself (login still works with their existing credentials)
- All `PlayedGame` rows the user participated in (foreign keys reference `Player` and `User`, neither is touched)
- All `Score` rows attributed to them
- All `PlayedGameReaction` rows they authored or received
- League memberships, owned leagues, owned game templates — untouched

**Email-less child safeguard.** Children created via the §6.4(b) flow may have no email. Before release/remove, the dialog warns:

> "{name} doesn't have an email on file. Without one, they can't recover their own password — only an admin could. Set an email for them now? \[Set email] \[Release anyway]"

The parent can set an email inline (writes to `User.email` + `emailVerified` left null so the child can verify on next login). If they choose "Release anyway", the release proceeds; the child keeps their username + password and can add an email later from their own `/app/settings`.

**Last-parent edge case.** If only one parent remains, they must designate a new parent or disband first. If the lone parent leaves with children still present, the family is auto-disbanded (see §6.7) — every remaining child is released to independence, and any pool `permanentCredits` are transferred to the leaving parent.

### 6.7 Disbanding a family

Triggered by a parent on `/app/family → Settings → Disband`. Equivalent to "release every member at once" plus tear down the family entity.

- Every `FamilyMember` row deleted. All members keep their `User`, all play history, all reactions — same preservation guarantees as §6.6.
- Each released member's `User.monthlyCredits` resumes accruing on next cron; their (previously frozen) `User.permanentCredits` becomes relevant again.
- `Family.permanentCredits` is transferred to the disbander's `User.permanentCredits` (UI: "Your family's 47 remaining credits have been moved to your personal balance").
- `Family.monthlyCredits` is forfeit (it was a perk of being in a family).
- Family row is soft-deleted (kept so historical `CreditTransaction` rows still resolve their `family` relation).
- Email-less children among the released members trigger a list in the confirm dialog: "These children don't have an email and won't be able to recover their own password: {name1}, {name2}. Set emails for them first? \[Manage children] \[Disband anyway]"

### 6.8 `/app/family` parent dashboard

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

- Members list shows role, join date, and (for children) per-month credit usage.
- Tapping a member opens a detail sheet with usage breakdown and "Remove from family" (parents only).
- Recent activity is the union of all members' approved games, descending by `playedAt`.

### 6.9 `/app/credits` for family members

- **Parents**: balance shows the family pool prominently; existing "buy credits" CTA continues to work (purchases route into the family wallet). Below the pool, a collapsed section shows their (frozen) personal balance for context.
- **Children**: balance shows the family pool with a "Managed by {parent name}" label; buy CTA is replaced with a passive "Family credits are managed by {parent name}" note. Personal balance is not shown (avoids confusion).

### 6.10 Caps

- **Family size**: hard cap of 6 total members (parents + children), enforced server-side in `addParent` / `addChild` / `acceptFamilyInvite`. No other anti-abuse signals.

### 6.11 Translation keys (additions)

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
    "releaseMember": "Vrijgeven aan eigen account",
    "releaseMemberBody": "{name} houdt hun account, spelhistorie en reacties. Vanaf de volgende maand krijgen ze hun eigen maandelijkse credits.",
    "noEmailWarning": "{name} heeft geen e-mail. Zonder e-mail kunnen ze hun eigen wachtwoord niet herstellen — alleen een beheerder kan dat. E-mail nu instellen?",
    "noEmailSetAction": "E-mail instellen",
    "noEmailReleaseAnyway": "Toch vrijgeven",
    "leaveFamilySelf": "Familie verlaten",
    "disbandConfirm": "Familie ontbinden? Resterende credits gaan naar jou. Alle leden houden hun account en spelhistorie.",
    "disbandNoEmailWarning": "Deze kinderen hebben geen e-mail en kunnen hun wachtwoord niet zelf herstellen: {names}.",
    "poolEmpty": "Familie-pool is leeg — vraag {name} om aan te vullen.",
    "familyInviteTitle": "{name} nodigt je uit voor hun familie",
    "familyInviteBody": "Accepteer om credits te delen.",
    "familyInviteAccepted": "Welkom bij de familie van {name}!",
    "addChildNameLabel": "Naam",
    "addChildUsernameLabel": "Gebruikersnaam",
    "addChildPasswordLabel": "Wachtwoord (kind kan dit later wijzigen)",
    "addChildEmailLabel": "E-mail (optioneel)",
    "familySizeCapReached": "Maximum aantal leden bereikt",
    "soloFamilyNoBonus": "Nodig een lid uit om het maandelijkse familietegoed te activeren."
  }
}
```

English mirrors.

---

## 7. Privacy & data edge cases

| Scenario | Behavior |
|---|---|
| Profile `full`, lists a game with Bartus; Bartus has `allowAppearInOthers = false`. | Game shown; Bartus rendered as "Speler B". Scores visible. |
| Profile set to `private`, then `full` again later. | Same URL works again. No redirect logic; no cache invalidation. |
| User changes username. | Old `/u/[username]` 404s. No redirect (intentional — username changes are rare, 404 is honest). |
| Account deletion. | All `PlayedGameReaction` rows cascade-delete. Username freed. If the user is a `FamilyMember`, that row cascade-deletes too; their share of the family wallet stays with the family. |
| Anonymous browser hits `/u/private-user`. | Generic 404. Do not reveal existence. |
| Reaction created, then league member is removed from the league. | Existing reactions remain (historical). New reactions blocked because authorization re-checks league membership at action time. |
| Game is rejected (approved → rejected via admin path). | Existing reactions stay (referenced game still exists). Card no longer surfaces in feeds because the query filters `status = 'approved'`. |
| Family member account deleted while family has only that member. | Family row stays (soft-deleted via disband-on-last-parent path) until the parent disbands explicitly, or via a follow-up cleanup job. |

---

## 8. Implementation grouping (3 plans)

Each plan ships independently. Plan 3 also handles a holistic landing-page + README sweep mentioning the full feature set across the three plans.

### Plan 1 — Engagement

| Step | Files touched |
|---|---|
| Prisma migration: `PlayedGameReaction` model | `prisma/schema.prisma`, new migration |
| `src/lib/reactions.ts` (allowed set constant) | new |
| `src/app/app/social/actions.ts` (`toggleReaction`) | new |
| `src/lib/social/loadFeed.ts` (`loadPersonalFeed`) | new |
| `src/components/social/Scorecard.tsx` | new |
| `/app/profile` restructure: identity card + feed | `src/app/app/profile/ProfileClient.tsx`, `page.tsx` |
| Compact-row reaction badge in `PaginatedGamesTable` | `src/components/stats/PaginatedGamesTable.tsx` |
| Two new notification types (`connection_game_logged`, `reaction_received`) + icon/color/route + email templates | `NotificationsClient.tsx`, `emailTemplates.ts`, `emailPreferences.ts` |
| Density: batching of `connection_game_logged` | `NotificationBell.tsx` rendering layer |
| Plan-1 landing/README copy update — feed + reactions section | `src/app/[locale]/(marketing)/page.tsx`, `README.md` |

### Plan 2 — Public Profile

One small migration (`publicProfileMode`, `allowAppearInOthers`) and a new public route.

| Step | Files touched |
|---|---|
| Prisma migration: `User.publicProfileMode` + `User.allowAppearInOthers` | `prisma/schema.prisma`, new migration |
| `src/lib/social/privacy.ts` | new |
| `loadPublicFeed` with anonymization (extends `loadFeed.ts` from Plan 1) | `src/lib/social/loadFeed.ts` |
| `src/app/[locale]/u/[username]/page.tsx` (+ generic 404) | new |
| `src/components/social/PublicProfileHero.tsx`, `TrophyShelf.tsx` | new |
| `/app/settings` Privacy section | `src/app/app/settings/sections/PrivacySection.tsx` (new) |
| Plan-2 landing/README copy update — public profile section | `src/app/[locale]/(marketing)/page.tsx`, `README.md` |

### Plan 3 — Family shared credits

Self-contained except for credit-deduction-on-log integration and the monthly cron.

| Step | Files touched |
|---|---|
| Prisma migration: `Family` + `FamilyMember` + `CreditTransaction.familyId` | `prisma/schema.prisma`, new migration |
| `src/lib/family/membership.ts` (member queries, role checks) | new |
| `src/app/app/family/actions.ts` (`createFamily`, `addParent`, `addChild`, `removeMember`, `leaveFamily`, `disband`, `acceptFamilyInvite`, `setMemberEmail`) | new |
| `removeMember` accepts an `intent: 'remove' \| 'release'` flag for analytics/audit; DB operation is identical for both. `/app/family` exposes "Remove from family" and "Release to own account" as two affordances mapping to this one action. `leaveFamily` is the member-initiated counterpart (auth: caller must be the member); `setMemberEmail` lets a parent add/update an email on a child's `User` before release (auth: caller must be a parent of the same family). | — |
| Family-invite via existing `ConnectionRequest` (`context: 'family_*'`) | `src/app/app/connections/actions.ts` extension |
| Family-invite QR/share-link token type + handler | new in `src/app/[locale]/family/invite/[token]/page.tsx` |
| Child-account creation flow (parent-managed credentials) | inside `family/actions.ts` |
| Modify game-logging credit deduction: route to `Family` wallet when user is a member | `src/app/app/leagues/[id]/log/actions.ts` (and wherever the existing deduction lives) |
| Monthly cron: family pool refill (150 when ≥2 members, 0 otherwise), skip member's own `User.monthlyCredits` if in a family | `src/app/api/cron/credit-reset/route.ts` |
| Block credit purchases for children; route parent purchases to family wallet | existing purchase action |
| `/app/family` parent dashboard (members list + pool + recent activity) | new |
| `/app/credits` family-aware rendering (pool view, child-locked buy CTA) | `CreditsClient.tsx` |
| Family-invite notification type | extend Notification system |
| Plan-3 landing/README copy update — family credits section; holistic sweep across landing & README mentioning all three plans' features (feed, reactions, public profile, privacy, family) | `src/app/[locale]/(marketing)/page.tsx`, `README.md`, `docs/design-guidelines.md` (Shared components registry §13) |

---

## 9. Open questions deferred to implementation plan

- Exact Redis bucket shape for reaction rate-limit (likely `INCR` with 1s TTL keyed on `react:{userId}:{playedGameId}:{emoji}`).
- Whether the compact-row reaction badge should also surface on league-detail's game-history list. Probably yes; confirm during implementation.
- Where exactly the played-game approval transition is fired — needed for the "fire `connection_game_logged` notification" hook. Enumerate every code path that transitions `status → 'approved'`.
- Family creation migrating `permanentCredits` into the family wallet — automatic at creation (current design) is simpler; the disband flow reverses it. Revisit if it surprises users.
- Whether a second parent can be invited from outside the family, or whether second-parent promotion must come from an existing child member graduating. Current design allows both — confirm.
- Whether a family with 1 member should still allow logging (deducting only from `permanentCredits`), or hard-block until ≥2 members. Current design: allows logging (the wallet exists, just doesn't refill).

---

## 10. What this spec deliberately drops vs. earlier revision

For future-Bartus reference (so we don't accidentally re-add what we cut):

- **Referral attribution** in any form — no `referredByUserId`, no payout hook, no welcome banner, no toast, no referrer notification, no "friends invited" chip.
- **Anti-abuse signal capture** — no `signupIp`, no `lastSeenIp`, no `signupUserAgent`, no `emailNormalized`, no `referralFlags`, no middleware extension for `lastSeenIp`.
- **Risk scoring & caps** — no `evaluateReferralRisk`, no per-referrer 30-day cap, no per-IP lifetime cap, no admin `/admin/referrals` page.
- **Per-IP family cap** — cut along with the above.
- **Per-member family monthly accrual** — replaced with flat 150/month (when ≥2 members).
- **Disposable-email blocklist** — not added.

If acquisition/abuse becomes a real concern later, these are re-addable as their own focused spec.
