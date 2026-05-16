# Dice Vault — Ticket Attachments Design
*Date: 2026-05-16*

---

## Overview

Users (and admins) can attach images to support ticket messages. Files are stored on disk via a Coolify persistent volume, served through an auth-gated route, and auto-deleted when the ticket closes (manual close, auto-close cron, or user account deletion). The thread keeps a placeholder where the image was.

---

## 1. Constraints & validation

- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/heic`, `image/heif`
- **Max size per file**: 3 MB (raw upload)
- **Max files per message**: 4 (UI cap)
- Validation on client (preflight UX) AND server (security boundary)
- HEIC/HEIF is converted to JPEG server-side before persisting so admins can preview iPhone screenshots in any browser

---

## 2. Storage

- Files stored at `${UPLOADS_DIR}/tickets/<ticketId>/<attachmentId>.<ext>` where `UPLOADS_DIR` env var defaults to `./uploads`
- On Coolify, this path is a persistent volume mount (e.g. `/data/uploads`)
- Files are NEVER served from `public/`. Access is via the auth-gated route
- Filename sanitisation: extension only (`.jpg`/`.jpeg`/`.png`); the on-disk filename is the attachment cuid + ext, not the user-supplied name

---

## 3. Data model

```prisma
model TicketAttachment {
  id         String        @id @default(cuid())
  messageId  String
  message    TicketMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  ticketId   String        // denormalised for fast cleanup-by-ticket
  ticket     Ticket        @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  filename   String        // original (display) filename, e.g. "screenshot.heic"
  storageKey String        // path within UPLOADS_DIR, e.g. "tickets/abc/xyz.jpg"
  mimeType   String        // post-conversion MIME (HEIC → image/jpeg)
  size       Int           // post-conversion size in bytes
  deletedAt  DateTime?     // null = on disk; set = file removed, show placeholder
  createdAt  DateTime      @default(now())

  @@index([ticketId])
  @@index([messageId])
}
```

`TicketMessage` gains `attachments TicketAttachment[]` relation.
`Ticket` gains `attachments TicketAttachment[]` relation.

---

## 4. Serve route

`GET /api/tickets/:ticketId/attachments/:attachmentId`

- Auth required
- Authorisation: requester is ticket owner OR has `role === 'admin'`
- Returns 404 if attachment missing, ticket missing, or attachment deletedAt is set
- Streams the file with the stored `mimeType` and `Cache-Control: private, max-age=300`
- Sets `Content-Disposition: inline; filename="<original>"`

---

## 5. Cleanup triggers

All three paths share a `deleteTicketAttachments(ticketId)` helper:

1. **Manual admin close** — `adminCloseTicket` calls helper before setting `status: 'closed'`
2. **Auto-close cron** — credit-reset route, after `updateMany({ status: 'closed' })`, iterates closed ticket IDs and calls helper for each
3. **User account deletion** — cascade delete removes DB rows; orphaned files are handled by a periodic sweep (out of scope for v1 — files inside `tickets/<ticketId>/` for any nonexistent ticket can be cleaned up later if needed)

The helper:
- Reads all attachments for the ticket where `deletedAt IS NULL`
- Unlinks each file from disk (swallow ENOENT)
- Sets `deletedAt = now()` on those rows (does NOT delete rows — placeholder preserved)
- Best effort: any file unlink error logged but does not block close

---

## 6. UI — User side (warm light theme)

### Uploader (in new ticket form + reply form)
- Drop zone: dashed border, paperclip icon, "Drop images or click to choose" text
- File picker on click or drag-drop
- Below the zone: thumbnail grid (64×64) of selected files with filename + size + ✕ remove button
- Per-file validation errors shown beneath the thumbnail in red
- "Add another" disabled when 4 files reached
- Accepted hint: "JPG, PNG, HEIC · max 3 MB"

### Thread display
- Below each message body, attachment thumbnails (max-width 160px, rounded corners)
- Click thumbnail → lightbox (fixed overlay, dim background, image centred, ✕ in corner, click outside or Esc closes)
- Deleted attachments: dashed-border placeholder ~64×64 with paperclip icon and "Image removed when ticket was closed" caption — displayed in chronological order alongside any remaining ones

---

## 7. UI — Admin side (dark theme)

Same component logic, dark palette. Admin reply form also gets an uploader. Lightbox identical.

---

## 8. Server actions

`createTicket(formData)` / `replyToTicket(ticketId, formData)` / `adminReplyToTicket(ticketId, formData)` accept a multi-file `attachments` field. Each:

1. Validates each file (MIME via magic bytes + extension, size ≤ 3 MB, count ≤ 4)
2. For HEIC/HEIF: converts to JPEG quality 85 via `heic-convert`
3. Writes file to disk
4. Creates `TicketAttachment` row in the same transaction as the message

Reply form switches from `replyToTicket(ticketId, body: string)` to `replyToTicket(ticketId, formData: FormData)` — `body` extracted server-side.

---

## 9. Dependencies

- `heic-convert` (pure JS, no native deps — safe for Coolify Alpine/Debian containers)

---

## 10. Out of scope (v1)

- Non-image attachments (PDF, video) — explicitly rejected by MIME check
- Image resizing / thumbnail generation — 3 MB cap makes raw display acceptable
- Orphaned-file sweep — only relevant if cascade deletes leak; can add a cron sweep later
- Re-uploads after deletion — closed tickets stay closed; users open a new ticket
