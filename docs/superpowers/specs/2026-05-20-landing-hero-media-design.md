# Landing Hero Media — Design

**Date:** 2026-05-20
**Status:** Approved

## Problem

The landing page hero visual is a hardcoded static file (`public/hero-game-night.jpg`).
Changing it requires editing code and redeploying. The admin should be able to upload a
custom image or a short video from the admin panel, without a redeploy.

## Decisions

- **Media types:** one image *or* one video at a time (a single hero slot).
- **Video playback:** auto-play, muted, looping, `playsInline` — an ambient background clip.
- **Default state:** when nothing is uploaded, the hero falls back to the bundled
  `public/hero-game-night.jpg`. "Remove" reverts to this default.
- **Size limits:** images max 8 MB; videos max 25 MB.
- **Allowed formats:** images JPEG / PNG / WebP; videos MP4 (H.264) / WebM.

## Approach

Reuse existing infrastructure:

- **`AdminSettings`** key-value table stores a small JSON descriptor of the current hero media.
- **Uploads volume** (`src/lib/uploads.ts`) stores the actual file — persistent across Coolify
  redeploys, unlike `public/`.
- **A public API route** streams the file to landing-page visitors.

Rejected alternatives:

- **Write into `public/`** — files written at runtime are wiped on every Coolify redeploy.
- **External blob storage (S3 etc.)** — no provider configured; overkill for one file.

The marketing page (`src/app/[locale]/(marketing)/page.tsx`) already calls `auth()` and
Prisma, so it is dynamically rendered. A newly uploaded hero appears immediately — no
static-generation or redeploy concern.

## Components

### 1. Data — `AdminSettings` key `landing.heroMedia`

JSON value:

```jsonc
{
  "kind": "image" | "video",
  "storageKey": "landing/<cuid>.<ext>",
  "mimeType": "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm",
  "uploadedAt": "2026-05-20T12:00:00.000Z"
}
```

Key absent → no custom media → fall back to the bundled photo.

### 2. Storage — extend `src/lib/uploads.ts`

New constants and helpers, mirroring the existing attachment helpers:

- `LANDING_IMAGE_MIME_TYPES` = jpeg, png, webp; `LANDING_IMAGE_MAX_BYTES` = 8 MB.
- `LANDING_VIDEO_MIME_TYPES` = mp4, webm; `LANDING_VIDEO_MAX_BYTES` = 25 MB.
- `saveLandingMedia(id, ext, data)` → writes to `landing/<id>.<ext>`, returns the storage key.
- `deleteLandingMedia(storageKey)` → unlinks the file (ignores ENOENT).
- A streaming read helper, or reuse `resolveStoragePath` so the API route can open a
  read stream rather than buffering the whole video in memory.

Replacing or removing media deletes the previous file before/after writing the new one.

### 3. Admin UI — `/admin/landing/hero`

New page, dark admin theme, Dutch copy (matches the rest of the admin panel).

- Linked from a new card on `/admin/landing/page.tsx` ("Hero afbeelding / video"),
  matching the existing Reviews card pattern.
- Shows the current hero: a preview (image or muted looping video), or "Standaardafbeelding
  wordt gebruikt" when none is set.
- A file picker to upload a new image or video.
- A "Verwijderen / terug naar standaard" button when custom media is set.
- Server actions in `src/app/admin/landing/hero/actions.ts`:
  - `uploadHeroMedia(formData)` — admin-only; validates MIME type + extension + size against
    the limits; on success writes the file, deletes any previous file, updates the
    `landing.heroMedia` setting, `revalidatePath` the landing route.
  - `removeHeroMedia()` — admin-only; deletes the file and the setting.
  - Both reject non-admin sessions and surface validation errors to the UI.

### 4. Public serving — `GET /api/landing/hero-media`

- No auth (public landing-page asset).
- Reads the `landing.heroMedia` setting; if absent → `404` (the page then renders the
  bundled fallback).
- Streams the file from the uploads volume (does not buffer the whole video in memory).
- Headers: `Content-Type` from the descriptor; `Cache-Control: public, max-age=...`.
- Range requests are not required for an auto-playing looping clip; serve the full body.
  (Optional future enhancement, out of scope.)

### 5. Marketing page — `HeroMedia` component

New client/server component rendered inside the existing framed hero box in
`src/app/[locale]/(marketing)/page.tsx` (right column, lines ~203–218).

- Reads the `landing.heroMedia` setting on the server and passes the descriptor down.
- Fixed aspect-ratio box with `object-fit: cover` so any uploaded dimensions look right.
- `kind === 'image'` → `<img src="/api/landing/hero-media?v=<uploadedAt>" ...>`.
- `kind === 'video'` → `<video autoplay muted loop playsInline src="/api/landing/hero-media?v=<uploadedAt>">`.
- no descriptor → existing `<Image src="/hero-game-night.jpg" .../>` fallback.
- The `?v=<uploadedAt>` query busts the browser cache when media changes.
- The amber glow ring, rounded corners, bottom vignette, and floating decorative dice
  all stay exactly as they are today.

## Data Flow

1. Admin uploads a file at `/admin/landing/hero`.
2. Server action validates, writes the file to the uploads volume, deletes any prior file,
   updates `AdminSettings['landing.heroMedia']`, revalidates the landing route.
3. A visitor loads the landing page; the server reads the setting and renders `HeroMedia`.
4. The browser requests `/api/landing/hero-media?v=<uploadedAt>`; the route streams the file.

## Error Handling

- Upload: invalid MIME type, wrong extension, or over the size limit → server action
  returns a validation error shown inline in the admin UI; no file written, setting unchanged.
- Non-admin caller of any server action → rejected.
- API route, setting absent → `404`; the page already renders the fallback regardless.
- API route, setting present but file missing on disk → `404`; page falls back. The admin
  UI shows the descriptor as set, so a "re-upload" path remains available.

## Testing

- `uploads.ts` helpers: save returns the expected key; delete is ENOENT-safe;
  path traversal stays blocked.
- Upload server action: rejects oversized files, rejects disallowed MIME types,
  rejects non-admin callers, deletes the previous file on replace.
- API route: `404` when no setting; correct `Content-Type` when set.

## Out of Scope (YAGNI)

- Per-locale hero media.
- Video poster frames / custom thumbnails.
- Scheduling or multiple hero variants / A-B rotation.
- HTTP Range request support for the video.
