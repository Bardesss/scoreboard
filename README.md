# 🎲 Dice Vault

> Board game score tracking SaaS — track scores, leagues, and players across your game nights.
> Live at [dicevault.fun](https://dicevault.fun)

**Stack:** Next.js 15 · Prisma 5 · PostgreSQL · Redis · NextAuth v5 · next-intl (nl/en) · Recharts · Tailwind · Coolify

---

## 🧰 Prerequisites

- Node.js 22+
- Docker + Docker Compose (for local PostgreSQL + Redis)
- A [Coolify](https://coolify.io) instance (v4+) for production deploys

---

## 🚀 Local Development

```bash
# 1. Copy env file and fill in values
cp .env.example .env.local

# 2. Start PostgreSQL and Redis
docker compose up -d db redis

# 3. Run migrations + seed AdminSettings
npx prisma migrate dev
npx prisma db seed

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🌍 Environment Variables

### Always required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NEXTAUTH_SECRET` | Random secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Full public URL, e.g. `https://dicevault.fun` |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL`, used client-side |
| `CRON_SECRET` | Random string to authenticate `/api/cron/credit-reset` — `openssl rand -base64 32` |
| `UPLOADS_DIR` | Absolute path where uploaded files are stored — support ticket attachments and the landing-page hero image/video. Must point inside a Coolify persistent volume (e.g. `/data/uploads`) — otherwise uploads vanish on every container restart. Defaults to `./uploads` for local dev. |

> **Email (Mailgun):** Configured via `/admin/settings/integrations` — no ENV vars needed.
> `NEXTAUTH_SECRET` rotation invalidates stored integration credentials; re-enter them in the admin UI after rotating.

### Optional — Umami analytics dashboard

Set these to surface website analytics on the admin dashboard (`/admin`) and a
connection test on `/admin/settings/integrations`. All optional: if any are
missing, the analytics panel is simply hidden — nothing fails.

| Variable | Description |
|---|---|
| `UMAMI_API_URL` | Public base URL of the Umami instance, e.g. `https://analytics.bartusoost.nl`. |
| `UMAMI_INTERNAL_URL` | **Recommended on Coolify.** Internal base URL for server-to-server API calls, e.g. `http://umami-xxxx:3000`. Used in preference to `UMAMI_API_URL` so the app container reaches Umami over the internal Docker network instead of the public URL (which a container often cannot reach via hairpin NAT). The browser tracking tag always uses the public URL. |
| `UMAMI_WEBSITE_ID` | Website UUID (same id as the tracking tag). |
| `UMAMI_USERNAME` | Umami login user (read access to the website). |
| `UMAMI_PASSWORD` | Umami login password. |

> If the dashboard shows "tijdelijk niet beschikbaar", open
> `/admin/settings/integrations` → Umami → **Test verbinding** for the precise
> reason (unreachable URL, bad credentials, wrong website-id, or the Umami user
> not being linked to the site).

### Future / not yet active

| Variable | When | Description |
|---|---|---|
| `MOLLIE_API_KEY` | Phase 11a | Mollie live API key |
| `STRIPE_SECRET_KEY` | Phase 11a | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Phase 11a | Stripe webhook signing secret |
| `STRIKE_API_KEY` | Phase 11b | Strike API key (Bitcoin Lightning) |

---

## ☁️ Coolify Setup

### 1️⃣ Create PostgreSQL 18 service

1. Coolify → **New Resource** → **Database** → **PostgreSQL 18**
2. Name: `dicevault-db`
3. Copy the generated `DATABASE_URL`

### 2️⃣ Create Redis 8 service

1. Coolify → **New Resource** → **Database** → **Redis 8**
2. Name: `dicevault-redis`
3. Copy the generated `REDIS_URL`

### 3️⃣ Create the application

1. Coolify → **New Resource** → **Application** → **GitHub**
2. Select the `scoreboard` repository, branch `main`
3. Build Pack → **Dockerfile** · Dockerfile path: `Dockerfile` · Exposed port: `3000`
4. **Health Checks** tab → set Path to `/api/health`

### 4️⃣ Set environment variables

Add all required variables from the table above. Example minimum:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://dicevault.fun
NEXT_PUBLIC_APP_URL=https://dicevault.fun
CRON_SECRET=...
UPLOADS_DIR=/data/uploads
```

### 5️⃣ Mount a persistent volume for uploads

Support ticket attachments and the landing-page hero image/video are written to disk. Without a persistent volume, those files are wiped on every container restart. Both features share this one volume (the app stores them in `tickets/` and `landing/` subfolders).

In the app resource → **Storage** tab → **+ Add**:

| Field | Value |
| --- | --- |
| Source path (host) | `dicevault-uploads` (Coolify-managed volume) |
| Destination path (container) | `/data/uploads` (must match `UPLOADS_DIR`) |

### 6️⃣ Migrations

Migrations run automatically on every container start — the Dockerfile `CMD` is `node node_modules/prisma/build/index.js migrate deploy && node server.js`. **Do not** configure a Coolify "Post-deploy command" for migrations: the runtime image is the slim Next standalone output and does not expose the `prisma` CLI on `$PATH`, so any `prisma migrate deploy` post-deploy hook will fail with `sh: prisma: not found` and mark the deploy as failed even though the app started cleanly.

### 7️⃣ Deploy 🚢

Click **Deploy**. First build takes ~3–5 minutes. Verify:
```bash
curl https://yourdomain.com/api/health
# → {"db":"ok","redis":"ok"}
```

---

## 🏁 First-Time Setup After Deploy

Run these once after the first successful deploy:

```bash
# Seed AdminSettings (action costs, free mode defaults, thresholds)
npx prisma db seed

# Promote yourself to admin
npx tsx scripts/make-admin.ts your@email.com
```

> **On Coolify:** use the app resource → **Terminal** tab, or SSH + `docker exec` into the container.

Then log out and back in — the admin panel is available at `/admin`.

### Email verification without Mailgun

If Mailgun isn't configured yet (local dev or early deploy), verify an account manually:

```bash
npx tsx scripts/verify-email.ts your@email.com
```

---

## 🔄 GitHub Auto-Deploy

1. Coolify app → **Source** tab → enable **Auto deploy on push** → copy the webhook URL
2. GitHub repo → **Settings** → **Webhooks** → **Add webhook**
   - Payload URL: the Coolify webhook URL
   - Content type: `application/json`
   - Events: `Just the push event`

Every push to `main` triggers an automatic deploy. ✅

---

## ⏰ Monthly Credit Reset Cron

The `/api/cron/credit-reset` endpoint resets monthly credits for all eligible users and auto-closes stale tickets. It is **GET**, secured by `CRON_SECRET`, and idempotent — the same month can only run once thanks to a Redis lock.

Manual invocation:

```bash
curl https://yourdomain.com/api/cron/credit-reset \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Coolify Scheduled Task setup

In Coolify, open this application → **Scheduled Tasks** → **+ Add**:

| Field | Value |
| --- | --- |
| Name | `monthly-credit-reset` |
| Command | `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$NEXTAUTH_URL/api/cron/credit-reset"` |
| Frequency | `0 2 1 * *` (02:00 UTC on the 1st of every month) |
| Container | the app container |

Coolify injects the application's env vars into the task, so `$CRON_SECRET` and `$NEXTAUTH_URL` resolve automatically — no extra secrets to manage. Verify the task has run by checking its log in Coolify after the next 1st of the month.

---

## 🗄️ Migrations

Migrations run automatically on every container start via the Dockerfile `CMD` (`node node_modules/prisma/build/index.js migrate deploy && node server.js`) — no Coolify post-deploy hook needed. To run manually:

```bash
# Local
npx prisma migrate dev

# Production (one-off) — inside the running container
docker exec <container> node node_modules/prisma/build/index.js migrate deploy
```

---

## 📋 Changelog

| Phase | What was added |
|---|---|
| **1a** | Next.js 15 · Prisma 5 · Redis · `/api/health` · Dockerfile · Coolify deploy |
| **1b** | next-intl (nl/en) · NextAuth v5 · TOTP MFA · Mailgun email verification · landing page · auth pages · app shell |
| **2** | Players CRUD · Game Template wizard · League creation · PlayedGame logging · dual-pool credit engine · low-credit banner |
| **2b** | Improved game wizard — 5-step adaptive flow with win types, scoring config, buy-in, colour + icon |
| **3** | Social connections · notification bell · dashboard stats · shareable game links · PlayedGame approval flow |
| **4** | Admin panel · user management · credit adjustment · discount codes · landing CMS · cookie consent · email notifications |
| **5** | Session participant selection · win ratio on league page and dashboard |
| **6A** | Support ticket system · monthly credit reset cron · `requiresMfa` enforcement · low-credit warning emails |
| **6B** | Credit analytics dashboard (`/admin/credits`) · tax export scaffold (`/admin/billing/tax-export`) |
| **7** | `Integration` model · AES-256-GCM credential encryption · Mailgun moved from ENV to DB · integrations admin UI |
| **8** | Dashboard redesign — 2×2 ranked-list panels (ranking, top games, play days, leagues) · paginated games table · Redis-cached stats |
| **9** | Adaptive log form per `winType` (points/time/cooperative/team/ranking/elimination/roles) · `ScoreEntry.isWinner` as single source of truth · per-winType winner resolver |
| **10** | League stats expansion (9 panels) · shared stats library (`src/lib/stats/`) · date-range filter (week/month/year/all/custom) · skeleton loaders · bar/panel/count-up animations · Recharts charts (missions, frequency, win-trend) · i18n sweep (`app.stats` namespace) |
| **6C** | Support ticket image attachments (JPG/PNG/HEIC, 8 MB · 4 files max) · server-side sharp pipeline (resize ≤2000 px, JPEG q=82, EXIF stripped, HEIC→JPEG) · auth-gated serve route · drag-drop uploader + lightbox · auto-delete files on ticket close with placeholder · `UPLOADS_DIR` + persistent volume |
| **6D** | User settings page (`/app/settings`) — TOTP enable/disable + backup-codes regenerate (with QR code, backup-codes reveal-once + download) · language preference (NL/EN, JWT-refreshed via `useSession().update`) · change password |
| **Plan A** | **Social layer:** personal activity feed on `/app/profile` · emoji reactions (🔥 👏 🎲 😅 💪) on approved games · opt-in public profiles at `/u/<username>` (three privacy levels) · reaction badge in dashboard games table · two new notification types (`connection_game_logged` with batching, `reaction_received`) |
