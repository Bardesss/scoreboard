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

> **Email (Mailgun):** Configured via `/admin/settings/integrations` — no ENV vars needed.
> `NEXTAUTH_SECRET` rotation invalidates stored integration credentials; re-enter them in the admin UI after rotating.

### Future / not yet active

| Variable | When | Description |
|---|---|---|
| `MOLLIE_API_KEY` | Phase 7 | Mollie live API key |
| `STRIPE_SECRET_KEY` | Phase 7 | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Phase 7 | Stripe webhook signing secret |
| `STRIKE_API_KEY` | Phase 8 | Strike API key (Bitcoin Lightning) |

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
```

### 5️⃣ Post-deploy command

In app settings → **Post-deploy command**:
```
npx prisma migrate deploy
```

### 6️⃣ Deploy 🚢

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

The `/api/cron/credit-reset` endpoint resets monthly credits for all users. Call it monthly via any cron provider (Coolify Cron, GitHub Actions, cron-job.org, etc.):

```bash
curl -X POST https://yourdomain.com/api/cron/credit-reset \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 🗄️ Migrations

Migrations run automatically on every deploy via the post-deploy command. To run manually:

```bash
# Local
npx prisma migrate dev

# Production (one-off)
npx prisma migrate deploy
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
