# Dice Vault — Support Ticket System Design
*Date: 2026-04-17*

---

## Overview

Users can report bugs, give feedback, or ask questions via an in-app ticket system. Tickets are managed in the admin panel with two-way conversation threads. Auto-close after 7 days of user inactivity following an admin reply.

---

## 1. Data model

```prisma
model Ticket {
  id          String          @id @default(cuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    String          // "bug" | "feedback" | "question"
  subject     String
  status      String          @default("open")  // "open" | "closed"
  autoCloseAt DateTime?       // set when admin replies; null when no reply yet or closed
  messages    TicketMessage[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model TicketMessage {
  id         String   @id @default(cuid())
  ticketId   String
  ticket     Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  senderType String   // "user" | "admin"
  body       String   @db.Text
  createdAt  DateTime @default(now())
}
```

`User` gains `tickets Ticket[]` relation.

---

## 2. Ticket flow

### User submits
- Form at `/app/support/new`: category picker (Bug / Feedback / Question), subject field, message body
- Creates `Ticket` (`status: "open"`, `autoCloseAt: null`) + first `TicketMessage` (`senderType: "user"`)

### Admin replies
- In `/admin/tickets/[id]`: types reply, submits
- Creates `TicketMessage` (`senderType: "admin"`)
- Sets `ticket.autoCloseAt = now() + 7 days`
- Sends `ticket_replied` email to user

### User replies
- In `/app/support/[id]`: types reply on open ticket
- Creates `TicketMessage` (`senderType: "user"`)
- Resets `ticket.autoCloseAt = now() + 7 days`

### Admin closes manually
- "Close ticket" button in `/admin/tickets/[id]`
- Sets `status: "closed"`, `autoCloseAt: null`
- Sends `ticket_closed` email to user

### Auto-close (cron)
- Runs nightly (can share the credit-reset cron schedule or have its own)
- Closes all tickets where `status = "open"` AND `autoCloseAt < now()`
- Sets `status: "closed"`, `autoCloseAt: null`
- Sends `ticket_auto_closed` email to user

### Closed tickets
- Read-only for both sides — no reply form shown
- User sees: "This ticket is closed."
- Cannot be reopened by either party

---

## 3. User UI (`/app/support`)

### Ticket list (`/app/support`)
- Lists user's own tickets only
- Columns: category badge, subject, status badge (open / closed), last activity date
- "New ticket" button → `/app/support/new`
- Empty state: "No tickets yet. Have a question or found a bug? Let us know."

### New ticket form (`/app/support/new`)
- Category: segmented picker — Bug / Feedback / Question
- Subject: text input (max 200 chars)
- Message: textarea (max 5000 chars)
- Submit → redirect to `/app/support/[id]`

### Ticket detail (`/app/support/[id]`)
- Full message thread:
  - User messages: right-aligned, user's avatar
  - Admin replies: left-aligned, "Dice Vault Support" label
- Timestamps on each message
- **Open ticket**: reply textarea + send button at bottom
- **Closed ticket**: reply form replaced with "This ticket is closed." note
- Auto-close notice when `autoCloseAt` is set: "This ticket will be automatically closed on [date] if no reply is received."

---

## 4. Admin UI (`/admin/tickets`)

### Ticket list (`/admin/tickets`)
- All tickets from all users
- Filter by: status (all / open / closed), category (all / bug / feedback / question)
- Sort by: newest / oldest / last activity
- Columns: user email, category badge, subject, status, last activity, auto-close countdown
- **Unread indicator**: sidebar badge showing count of open tickets with no admin reply yet (i.e. last message is `senderType: "user"`)

### Ticket detail (`/admin/tickets/[id]`)
- Same thread view as user side
- Reply textarea + "Send Reply" button
- "Close Ticket" button (separate from reply)
- Auto-close countdown: "Auto-closes in X days" when `autoCloseAt` is set (shown as amber warning when < 1 day)
- Closed tickets: thread shown read-only, no reply form, "Reopen" is intentionally absent

---

## 5. Email notifications

Keys in `messages/{locale}/emails.json`:

| Key | Trigger | Recipient |
|---|---|---|
| `ticket_replied` | Admin sends a reply | User |
| `ticket_closed` | Admin manually closes ticket | User |
| `ticket_auto_closed` | Nightly cron auto-closes | User |

**English copy:**
```json
{
  "ticket_replied": {
    "subject": "New reply to your support ticket",
    "body": "The Dice Vault support team replied to your ticket: \"{subject}\". Log in to view the reply."
  },
  "ticket_closed": {
    "subject": "Your support ticket has been closed",
    "body": "Your ticket \"{subject}\" has been closed by our support team."
  },
  "ticket_auto_closed": {
    "subject": "Your support ticket was automatically closed",
    "body": "Your ticket \"{subject}\" was automatically closed after 7 days without a reply. If you still need help, please open a new ticket."
  }
}
```

**Dutch copy:**
```json
{
  "ticket_replied": {
    "subject": "Nieuw antwoord op je supportticket",
    "body": "Het Dice Vault supportteam heeft gereageerd op je ticket: \"{subject}\". Log in om het antwoord te bekijken."
  },
  "ticket_closed": {
    "subject": "Je supportticket is gesloten",
    "body": "Je ticket \"{subject}\" is gesloten door ons supportteam."
  },
  "ticket_auto_closed": {
    "subject": "Je supportticket is automatisch gesloten",
    "body": "Je ticket \"{subject}\" is automatisch gesloten na 7 dagen zonder reactie. Als je nog hulp nodig hebt, open dan een nieuw ticket."
  }
}
```

---

## 6. Phase placement

| Phase | Work |
|---|---|
| **4** | Ticket model + migrations + user `/app/support` pages + admin `/admin/tickets` pages + manual close + email notifications |
| **6** | Auto-close cron + `ticket_auto_closed` email |
