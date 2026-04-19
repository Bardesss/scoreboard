# 🎲 Dice Vault

> Board game score tracking SaaS — store your scores safely at [dicevault.fun](https://dicevault.fun)

---

## 🧰 Prerequisites

- Node.js 22+
- Docker + Docker Compose
- A [Coolify](https://coolify.io) instance (v4+) on a VPS
- A GitHub account (for auto-deploy webhook)

---

## 🚀 Local Development

**1. Copy env file and fill in values**
```bash
cp .env.example .env.local
```

**2. Start PostgreSQL and Redis**
```bash
docker compose up -d db redis
```

**3. Run migrations**
```bash
npx prisma migrate dev
```

**4. Start the dev server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the Phase 1a placeholder.

---

## 🌍 Environment Variables

| Variable | Required | Description | Phase |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | 1a |
| `REDIS_URL` | ✅ | Redis connection string | 1a |
| `NEXTAUTH_SECRET` | ✅ | Random secret — generate with `openssl rand -base64 32` | 1a |
| `NEXTAUTH_URL` | ✅ | Full public URL, e.g. `https://dicevault.fun` | 1a |
| `NEXT_PUBLIC_APP_URL` | ✅ | Same as `NEXTAUTH_URL`, used client-side | 1a |
| `MAILGUN_API_KEY` | ✅ | Mailgun API key | 1b |
| `MAILGUN_DOMAIN` | ✅ | Mailgun sending domain | 1b |
| `MAILGUN_FROM` | ✅ | From address, e.g. `Dice Vault <noreply@dicevault.fun>` | 1b |
| `MOLLIE_API_KEY` | Phase 5 | Mollie live API key | 5 |
| `STRIPE_SECRET_KEY` | Phase 5 | Stripe secret key | 5 |
| `STRIPE_WEBHOOK_SECRET` | Phase 5 | Stripe webhook signing secret | 5 |
| `STRIKE_API_KEY` | Phase 7 | Strike API key (Bitcoin Lightning) | 7 |

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
3. Build Pack → **Dockerfile**
4. Dockerfile path: `Dockerfile`
5. Exposed port: `3000`
6. After saving, open the **Health Checks** tab → set Path to `/api/health`

### 4️⃣ Set environment variables

Add all variables from the table above. Minimum for Phase 1a:

```
DATABASE_URL=...
REDIS_URL=...
NEXTAUTH_SECRET=...       # openssl rand -base64 32
NEXTAUTH_URL=https://dicevault.fun
NEXT_PUBLIC_APP_URL=https://dicevault.fun
```

### 5️⃣ Set post-deploy command

In app settings → **Post-deploy command**:
```
npx prisma migrate deploy
```

### 6️⃣ Deploy 🚢

Click **Deploy**. First build takes ~3–5 minutes.

Verify it's live:
```bash
curl https://yourdomain.com/api/health
# → {"db":"ok","redis":"ok"}
```

---

## 🔄 GitHub Auto-Deploy

1. Coolify app → **Source** tab → enable **Auto deploy on push** → copy the webhook URL
2. GitHub repo → **Settings** → **Webhooks** → **Add webhook**
   - Payload URL: the Coolify webhook URL
   - Content type: `application/json`
   - Events: `Just the push event`

Every push to `main` now triggers an automatic deploy. ✅

---

## 🗄️ Running Migrations

Migrations run automatically via the post-deploy command on Coolify. To run manually:

```bash
# Local
npx prisma migrate dev

# Production (one-off)
npx prisma migrate deploy
```

---

## 📋 Phase Changelog

| Phase | What was added |
|---|---|
| 1a | Next.js 15 · Prisma 5 · Redis · `/api/health` · Dockerfile · Coolify deploy |
| 1b | next-intl (nl/en) · NextAuth v5 Credentials · TOTP MFA · Mailgun email verification · landing page · auth pages · app shell (sidebar + bottom nav) |
| 2 | Players CRUD · Game Template wizard (25 cr) · League creation (10 cr) · PlayedGame logging (5 cr) · credit deduction engine (dual-pool) · low-credit banner. No new env vars. Run `npx prisma db seed` after migrate to populate AdminSettings. |
