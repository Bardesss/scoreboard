# Account Avatar (Colour + Pictogram) — Design

**Date:** 2026-05-20
**Status:** Approved

## Problem

Avatars in Dice Vault are not customisable. The shared `Avatar` component
(`src/components/shared/Avatar.tsx`) renders a user/player as their **initials** on a
background colour **hashed from a seed** — no choice involved. The `User` account has no
avatar at all (the public profile shows a bare initial on an amber circle).

Users should be able to pick a **colour + pictogram** for their account avatar — the same
kind of picker that game templates already have (`color` + `icon` emoji, chosen in the
game wizard's `step1-basics.tsx`).

## Decision

The customisation is an **account avatar** (decided over a per-player picker): a user picks
a colour + pictogram for their own account in account settings. It is synced one-way to
their linked "me-player" so it appears everywhere they are shown. Friends-without-accounts
(non-account `Player` rows) keep auto-initials.

Customising means choosing **both** a colour and a pictogram together — there is no
colour-only mode. "Remove custom avatar" resets to auto-initials.

This mirrors the `displayName` design (`docs/superpowers/specs/2026-05-20-account-display-name-design.md`):
a `User` field that is the source of truth, one-way synced to the me-player.

## Components

### 1. Schema + migration — `prisma/schema.prisma`

- `User` gains `avatarColor String?` and `avatarIcon String?`. Null = not customised.
- `Player` gains `icon String?`. (`Player` already has `color String @default("#f5a623")`.)

The migration adds three nullable columns. **No backfill** — every user starts
uncustomised.

### 2. Avatar options — `src/lib/avatarOptions.ts` (new)

Exports two fixed lists:

- `AVATAR_COLORS: string[]` — a swatch palette of hex colours.
- `AVATAR_ICONS: string[]` — a curated set of friendly emoji pictograms (a dedicated
  avatar set — NOT the game/dice icon set, so avatars are not limited to board-game
  imagery).

Both the picker UI and the server action's validation consume these lists, so the allowed
set has a single source of truth.

### 3. `Avatar` component — `src/components/shared/Avatar.tsx`

Extended with two optional props: `color?: string | null` and `icon?: string | null`.

- When `icon` is truthy → render the `icon` emoji centred on the `color` background.
- When `icon` is falsy → current behaviour, unchanged: initials on `hashColor(seed)`.

`icon` presence is the single switch. Non-account players and uncustomised users have a
null `icon`, so they keep auto-initials with no special-casing at any call site. `color`
is only consulted when `icon` is set.

### 4. Server actions — account settings (`src/app/app/settings/actions.ts`)

- `updateAvatar(color, icon)`:
  - Requires a session (owner-only).
  - Validates `color` is in `AVATAR_COLORS` and `icon` is in `AVATAR_ICONS`; rejects
    otherwise.
  - Writes `User.avatarColor` + `User.avatarIcon`.
  - Syncs the linked me-player (`Player` where `linkedUserId = session.user.id`):
    `Player.color = color`, `Player.icon = icon` (via `updateMany` — a no-op if the user
    has no me-player). One-way only.
  - `revalidatePath` the affected surfaces.
- `removeAvatar()`:
  - Requires a session.
  - Clears `User.avatarColor` + `User.avatarIcon` to null.
  - Clears the me-player's `Player.icon` to null. `Player.color` is left as-is (harmless —
    `Avatar` ignores `color` when `icon` is null).

`updatePlayer` is **not** touched: the linked-player edit control is already hidden in the
Players UI (from the display-name work), and non-account players intentionally get no
pictogram.

### 5. Settings UI — `AvatarSection`

A new section component in account settings (rendered by `SettingsClient`, beside the
Display name / Username sections). It shows:

- A colour swatch row (from `AVATAR_COLORS`) and a pictogram grid (from `AVATAR_ICONS`) —
  reusing the picker UX of the game wizard's `step1-basics.tsx`.
- A live preview of the resulting avatar.
- A Save action calling `updateAvatar`.
- A "Remove custom avatar" action calling `removeAvatar`, shown only when an avatar is set.

i18n: app-facing settings are internationalised — new keys go in the `app.profile`
namespace of `messages/{en,nl}/app.json`.

### 6. Site-wide adoption

Because the me-player carries `color` + `icon`, the chosen avatar appears wherever
`<Avatar>` renders the user. Thread `color` + `icon` from the player data into every
`<Avatar>` call site and add the two fields to the player queries/types feeding them:

- `src/components/stats/HeadToHeadGrid.tsx`
- `src/app/app/dashboard/DashboardClient.tsx`
- `src/app/app/leagues/[id]/LeagueStatsClient.tsx`
- `src/app/app/players/PlayersClient.tsx`
- plus the data sources behind them (the `src/lib/stats/*` loaders, `src/app/api/app/players/route.ts`, `src/app/app/players/page.tsx`).

The implementation plan audits for the complete set of `<Avatar>` usages and their
queries.

User-direct surfaces (not via the me-player) also render the chosen avatar, falling back
to the initial when uncustomised:

- `src/app/app/profile/ProfileClient.tsx` — the profile header avatar.
- `src/components/social/PublicProfileHero.tsx` — the public-profile hero avatar.

## Out of Scope (YAGNI)

- A colour-only avatar (no pictogram) — customising always sets both.
- Pictogram/colour pickers for non-account players (friends logged without accounts).
- Uploaded image avatars — pictogram + colour only.
- Changing how `Player.color` is used by charts/standings.

## Testing

- `updateAvatar` — rejects a `color` not in `AVATAR_COLORS`; rejects an `icon` not in
  `AVATAR_ICONS`; requires a session; on success writes `User.avatarColor`/`avatarIcon`
  and syncs the me-player's `Player.color`/`Player.icon`.
- `removeAvatar` — requires a session; clears the `User` fields and the me-player's
  `Player.icon`.
- The `Avatar` component's icon-vs-initials branch and the threading are verified by
  `npx tsc --noEmit`, consistent with the codebase having no React component render tests.
