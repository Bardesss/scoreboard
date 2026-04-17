# Dice Vault — Group & Social Features Design
*Date: 2026-04-17*

---

## Overview

Group features are the USP of Dice Vault. Vault keepers can connect with each other as players, form persistent **Leagues** around a single game, and collaboratively log results. Connected vault keepers also form a **social friend graph** — a foundation for future social features.

---

## 1. Terminology changes

| Old term | New term | Notes |
|---|---|---|
| Session | PlayedGame | Renamed throughout — now always belongs to a League |
| (none) | League | New persistent recurring group: one game + players |

---

## 2. Core concepts

### League
A **League** is a persistent recurring group — e.g. "Wednesday Catan with friends." It has:
- One **game template**
- A set of **players** (regular labels or connected vault keepers)
- An **owner** (the vault keeper who created it)
- Any number of **PlayedGames** logged over time

A League is reused indefinitely. You don't create a new one each week — you add a new PlayedGame to the existing League.

### PlayedGame (formerly Session)
A single play session within a League. Has a date, optional notes, scores per player, and a `status`:
- `approved` — logged by the owner, or accepted by the owner after a connected player submitted it
- `pending_approval` — submitted by a connected vault keeper, awaiting owner acceptance
- `rejected` — rejected by the owner; credits spent are non-refundable

### VaultConnection (social graph)
When a `ConnectionRequest` is accepted, a `VaultConnection` record is created for both directions. This is the social "friendship" between vault keepers — independent of any league. Foundation for future social features.

### Connected player
A `Player` record in A's vault with `linkedUserId` pointing to vault keeper B. B sees A's leagues in their own vault (via the linked player relationship). The connection can be severed and re-established at any time, or a different vault keeper can be linked to the same player slot.

---

## 3. Data model

### Modified: `Player`

```prisma
model Player {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  avatarSeed   String
  linkedUserId String?  // set when this player is a connected vault keeper
  linkedUser   User?    @relation("LinkedPlayer", fields: [linkedUserId], references: [id], onDelete: SetNull)
  scores       ScoreEntry[]
  leagueMembers LeagueMember[]
  createdAt    DateTime @default(now())
}
```

### New: `League`

```prisma
model League {
  id             String        @id @default(cuid())
  ownerId        String
  owner          User          @relation("OwnedLeagues", fields: [ownerId], references: [id], onDelete: Cascade)
  gameTemplateId String
  gameTemplate   GameTemplate  @relation(fields: [gameTemplateId], references: [id])
  name           String
  description    String?
  members        LeagueMember[]
  playedGames    PlayedGame[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}
```

### New: `LeagueMember`

```prisma
model LeagueMember {
  id        String   @id @default(cuid())
  leagueId  String
  league    League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  playerId  String
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([leagueId, playerId])
}
```

### Renamed: `Session` → `PlayedGame`

```prisma
model PlayedGame {
  id            String   @id @default(cuid())
  leagueId      String
  league        League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  submittedById String
  submittedBy   User     @relation("SubmittedPlayedGames", fields: [submittedById], references: [id])
  playedAt      DateTime
  notes         String?
  shareToken    String?  @unique
  status        String   @default("approved")  // "approved" | "pending_approval" | "rejected"
  scores        ScoreEntry[]
  createdAt     DateTime @default(now())
}
```

### Modified: `ScoreEntry`

`sessionId` renamed to `playedGameId`:

```prisma
model ScoreEntry {
  id           String     @id @default(cuid())
  playedGameId String
  playedGame   PlayedGame @relation(fields: [playedGameId], references: [id], onDelete: Cascade)
  playerId     String
  player       Player     @relation(fields: [playerId], references: [id])
  score        Int
}
```

### New: `ConnectionRequest`

```prisma
model ConnectionRequest {
  id          String   @id @default(cuid())
  fromUserId  String
  fromUser    User     @relation("SentRequests", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUserId    String?  // null when inviting a non-user by email
  toUser      User?    @relation("ReceivedRequests", fields: [toUserId], references: [id], onDelete: Cascade)
  toEmail     String?  // set when inviting a non-user
  inviteToken String?  @unique  // email link token for non-user invites
  context     String   // "player_list" | "league"
  leagueId    String?
  league      League?  @relation(fields: [leagueId], references: [id], onDelete: SetNull)
  status      String   @default("pending")  // "pending" | "accepted" | "declined"
  createdAt   DateTime @default(now())
  expiresAt   DateTime?
}
```

### New: `VaultConnection`

```prisma
model VaultConnection {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation("MyConnections", fields: [userId], references: [id], onDelete: Cascade)
  connectedUserId String
  connectedUser   User     @relation("ConnectedToMe", fields: [connectedUserId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())

  @@unique([userId, connectedUserId])
}
```

### New: `Notification`

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // see notification types below
  meta      Json?    // e.g. { fromUsername, leagueName, playedGameId }
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

---

## 4. Credit system updates

| Action | Cost | Who pays | Notes |
|---|---|---|---|
| Create game template | **25** | Vault owner | Updated from 10 |
| Create league | 10 | Vault owner | New |
| Send connection request | 10 | Requester | Deducted on send, not on acceptance |
| Log played game | 5 | Logger (owner or connected player) | Non-refundable even if rejected |

### AdminSettings seed changes

```
// Updated:
{ key: "cost_game_template", value: 25 }

// New:
{ key: "cost_league",        value: 10 }
{ key: "cost_add_player",    value: 10 }
```

### Terms of Service requirement

The Terms of Service (Privacy/Terms system page) must include: credits spent on played games logged by connected vault keepers are **non-refundable** regardless of acceptance or rejection by the league owner.

---

## 5. Connection flow

### By username or email (existing account)

1. A searches by username or email from Players page or League member list
2. `ConnectionRequest` created (`status: pending`, context set)
3. B receives in-app notification + email
4. B sees summary of the invite:
   - If context is `league`: shows existing played game history B is joining — B must explicitly accept the existing stats
   - If context is `player_list`: standard accept/decline
5. B accepts → `VaultConnection` created (both directions) + `Player.linkedUserId` set + `LeagueMember` created (if league context)
6. B declines → `ConnectionRequest` status set to `declined`, no records created

### By email (no account yet)

1. Same as above but `toUserId = null`, `toEmail` set, `inviteToken` generated
2. Invite email sent with a link containing the token
3. When B registers via the invite link, the system auto-finds the `ConnectionRequest` by token and auto-accepts it — league and player appear in B's vault immediately
4. If B registers without the invite link but with the same email, the system matches by email and auto-accepts pending invites

### By QR code

Each vault keeper's profile displays a QR code encoding their username. A scans from:
- **Players page** → creates `ConnectionRequest` with `context: "player_list"`
- **League member list** → creates `ConnectionRequest` with `context: "league"` and `leagueId` set

The QR resolution follows the same accept/decline flow as username search.

---

## 6. League flow

### Creating a league
1. A opens the League wizard: name, pick game template, add players (from connected players list)
2. Cost: 10 credits deducted from A
3. League created; for each member with `linkedUserId`, the league + game template appear in their vault with the "A's VAULT" ribbon

### Adding an already-connected vault keeper to an existing league
If B is already a connected player in A's vault (i.e. `Player.linkedUserId = B` exists), A can add B to any of their leagues at any time — no new `ConnectionRequest` is needed. A `LeagueMember` record is created and B receives a `league_invite` notification showing the existing played game history. B must accept before the league appears in their vault.

### What a connected vault keeper (B) sees
- A's league appears in B's Leagues list with the corner ribbon **"A's VAULT"**
- A's game template appears in B's Games list with the same ribbon
- B sees all approved PlayedGames in the league

### Logging a played game
- **A logs** → `status: approved` immediately, B sees it
- **B logs** → `status: pending_approval`, A receives in-app notification + email
  - A accepts → `status: approved`
  - A rejects → `status: rejected` (B notified; credits non-refundable)

### Disconnecting

**B disconnects (self-initiated):**
- `LeagueMember` records for B deleted across all of A's leagues
- `VaultConnection` deleted (both directions)
- `Player.linkedUserId` set to null — player becomes a regular editable player in A's vault
- All approved `PlayedGame` entries submitted by B remain

**A removes B:**
- Same cascade as above; B's contributions stay

### Re-connecting
Since the `Player` record is retained with `linkedUserId = null`, A can re-invite B at any time — a new `ConnectionRequest` is sent and the existing player slot is re-linked on acceptance. Alternatively, A can link a different vault keeper to that player slot.

---

## 7. Notification types

| Type | Trigger | Recipient |
|---|---|---|
| `connection_request` | A sends a connection request (player_list or league context) | B |
| `connection_accepted` | B accepts a connection request | A |
| `connection_declined` | B declines a connection request | A |
| `league_invite` | A adds an already-connected B to a league | B |
| `league_invite_accepted` | B accepts a league invite | A |
| `played_game_pending` | B submits a played game (pending approval) | A |
| `played_game_accepted` | A accepts B's submission | B |
| `played_game_rejected` | A rejects B's submission | B |

Email notifications use the same triggers. Email copy lives in `messages/{locale}/emails.json` under `emails.connection_*` and `emails.played_game_*` keys.

---

## 8. UI

### Visual indicator for shared content
Any League or GameTemplate owned by another vault keeper displays a **corner ribbon** in the primary color (`#005bc0`) reading **"[Owner]'s VAULT"** (top-right corner of the card). This applies in:
- League list
- Game template list
- Any page title / detail header for shared content

### Players page
- Lists regular players and connected vault keepers
- Connected vault keepers show a vault keeper icon badge next to their avatar
- Actions: invite (username / email / QR), disconnect, re-link

### League list / detail
- League cards show owner ribbon when applicable
- Detail page: member list shows vault keeper badge, played games show submitter, pending submissions show Accept / Reject action for the owner

### Profile page
- QR code displayed prominently for others to scan
- "Connections" section listing accepted vault keeper friends (social graph)

### Notification bell
- In app header, unread count badge
- Dropdown showing recent notifications with type icon and timestamp
- Mark as read on open

---

## 9. Phase placement

These features span multiple phases:

| Phase | Group features work |
|---|---|
| **2** | League model + PlayedGame rename + credit cost updates + league CRUD + played game flow (owner only, no connections yet) |
| **3** | Connection flow (invite / accept / QR) + VaultConnection + shared vault UI (ribbon) + notification system |
| **4** | Email notifications for connections + played game approval emails + admin: view pending approvals |

---

## 10. Open for future

- VaultConnection social graph: friend activity feed, public league leaderboards, discovery
- League invitations via shareable link
- Multi-game leagues (currently locked to one game template)
- League seasons / resets
