# Account Display Name — Design

**Date:** 2026-05-20
**Status:** Approved

## Problem

A Dice Vault account has a `username` (unique `@handle`, also used for `/u/[username]`
routing) but **no account-level display name**. The result is inconsistent and tangled:

- The `User` model has no `name`/`displayName` column.
- Registration collects a "name", but writes it to the user's linked **`Player`** row (the
  "me-player"), not the `User`.
- The **dashboard** greets the user with their me-player's name; the **profile page**
  shows `username ?? email`. Different surfaces show different things.

We want one account-level Display name, editable in account settings, used everywhere a
user's name is rendered.

## Decisions

- Add a real `User.displayName` column (Approach A — chosen over treating the me-player's
  name as the de-facto display name, which would leave an account identity living on a
  `Player` row).
- **One-way sync.** The Display name is edited only in account settings, by the account
  owner. Changing it also renames the owner's linked me-player. The reverse does not
  happen — see "Sync model" for why two-way sync is unsafe.
- Display name is free text (unlike the restricted `username`): 1–40 characters after
  trimming, non-unique.

## Sync model

`User.displayName` is the single source of truth. It is kept consistent with the linked
me-player's `Player.name` **one-way only**:

- `updateDisplayName` (account settings, owner-only) writes `User.displayName` AND the
  me-player's `Player.name`.
- A `Player` carries both an owner (`userId`) and an optional linked account
  (`linkedUserId`). Through the connection/link flow a player created by user A can be
  linked to user B — so B's me-player can be a row **owned by A**. Two-way sync (renaming
  the player → updating the linked account's `displayName`) would let A change B's
  Display name. That is the hole one-way sync closes.
- To prevent drift, a linked player cannot be renamed independently:
  **`updatePlayer` rejects a `name` change when the target player's `linkedUserId` is not
  null.** Such a player's name is governed by the linked account's Display name. Color and
  avatar edits via `updatePlayer` are unaffected. Unlinked players (friends logged without
  an account — the common case) rename freely, exactly as today.
- The me-player's `avatarSeed` is **not** changed when the Display name changes — a name
  edit should not reroll the avatar. (This is a deliberate divergence from `updatePlayer`,
  which recomputes `avatarSeed` from the name on a normal player rename.)

## Components

### 1. Schema + migration — `prisma/schema.prisma`

Add to `User`:

```prisma
displayName String?
```

Nullable. A migration adds the column, then backfills every existing row with a raw SQL
`UPDATE`:

```sql
UPDATE "User"
SET "displayName" = COALESCE(
  (SELECT p."name" FROM "Player" p WHERE p."linkedUserId" = "User"."id" LIMIT 1),
  "username"
)
WHERE "displayName" IS NULL;
```

The column stays nullable in the schema (simplest — no synthetic default); the resolver
(below) always supplies a fallback, so a null is never rendered.

### 2. Resolver — `src/lib/displayName.ts` (new)

```ts
export function resolveDisplayName(user: {
  displayName?: string | null
  username?: string | null
  email?: string | null
}): string
```

Returns `displayName` → else `username` → else the local-part of `email` → else `''`.
One function owns the precedence; today it is duplicated three inconsistent ways
(`ProfileClient`, the dashboard, `PlayersClient`).

### 3. Registration — `src/app/[locale]/(auth)/auth/actions.ts`

The `register` action already reads the `name` form field. It now also writes
`displayName: name` into the `prisma.user.create`. The me-player is still created with the
same `name` (unchanged). No registration-form UI change.

### 4. Settings — Display name editor

Add a "Display name" field to the account settings section that holds the username editor
(`src/app/app/settings/sections/AccountSection.tsx`). A new server action
`updateDisplayName(formData)`:

- Requires the session user (owner-only).
- Validates: trimmed length 1–40; rejects empty.
- Updates `User.displayName`.
- Updates the linked me-player (`Player` where `linkedUserId = session.user.id`)'s `name`
  — `avatarSeed` left untouched. If the user has no me-player, only `User.displayName` is
  written.
- `revalidatePath` the surfaces that show the name.

### 5. `updatePlayer` guard — `src/app/app/players/actions.ts`

`updatePlayer` rejects a `name` change when the target player's `linkedUserId` is not
null (returns a validation error). Color/avatar edits remain allowed. The Players UI
(`PlayersClient.tsx`) reflects this: a linked player's name is shown as managed by the
linked account, with no inline rename control for it.

### 6. Site-wide adoption

Route every render of a user's name through `resolveDisplayName`:

- Dashboard greeting (`src/app/app/dashboard/page.tsx`) — currently
  `mePlayer?.name ?? username ?? email-part`.
- Profile page (`src/app/app/profile/ProfileClient.tsx`) — currently `username ?? email`.
- Public profile `/u/[username]` — Display name as the heading, `@username` as the
  secondary handle.
- Any nav/shell that renders the user's name.

The implementation plan audits for any other site that renders a `User`'s name and routes
it through the resolver.

## Testing

- Unit-test `resolveDisplayName` — the full fallback chain (displayName / username /
  email-localpart / empty).
- Test `updateDisplayName` — validation (empty, over-length), writes both `User.displayName`
  and the me-player `name`, leaves `avatarSeed` untouched, no-ops the player write when no
  me-player exists, requires a session.
- Test the `updatePlayer` guard — a `name` change on a player with `linkedUserId != null`
  is rejected; an unlinked player still renames.

## Out of Scope (YAGNI)

- A separate display name per league or per context.
- Display-name uniqueness or moderation.
- Changing the `username` rules or the `/u/[username]` routing.
- Surfacing the Display name on the registration form as a distinctly-labelled field —
  the existing "name" field already collects it.
