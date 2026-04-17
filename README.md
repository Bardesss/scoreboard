# Dice Vault

Board game score tracking SaaS. [dicevault.fun](https://dicevault.fun)

---

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- A Coolify instance (v4+) running on a VPS
- A GitHub account (for auto-deploy webhook)

---

## Local development

1. Copy the example env file and fill in values:
   ```bash
   cp .env.example .env.local
   ```

2. Start PostgreSQL and Redis:
   ```bash
   docker compose up -d db redis
   ```

3. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Required | Description | Phase |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | 1a |
| `REDIS_URL` | ✅ | Redis connection string | 1a |
| `NEXTAUTH_SECRET` | ✅ | Random secret — generate with `openssl rand -base64 32` | 1a |
| `NEXTAUTH_URL` | ✅ | Full URL of the app (e.g. `https://dicevault.fun`) | 1a |
| `NEXT_PUBLIC_APP_URL` | ✅ | Same as `NEXTAUTH_URL` — used in client-side code | 1a |
| `MAILGUN_API_KEY` | ✅ | Mailgun API key | 1b |
| `MAILGUN_DOMAIN` | ✅ | Mailgun sending domain | 1b |
| `MAILGUN_FROM` | ✅ | From address, e.g. `Dice Vault <noreply@dicevault.fun>` | 1b |
| `MOLLIE_API_KEY` | Phase 5 | Mollie live API key | 5 |
| `STRIPE_SECRET_KEY` | Phase 5 | Stripe secret key | 5 |
| `STRIPE_WEBHOOK_SECRET` | Phase 5 | Stripe webhook signing secret | 5 |
| `STRIKE_API_KEY` | Phase 7 | Strike API key (Bitcoin Lightning) | 7 |

---

## Coolify setup

### 1. Create PostgreSQL service

1. Coolify dashboard → New Resource → Database → PostgreSQL 18
2. Name: `dicevault-db`
3. Copy the generated `DATABASE_URL`

### 2. Create Redis service

1. Coolify dashboard → New Resource → Database → Redis 7
2. Name: `dicevault-redis`
3. Copy the generated `REDIS_URL`

### 3. Create the Next.js application

1. Coolify dashboard → New Resource → Application → GitHub
2. Select the `scoreboard` repository, branch `main`
3. Build Pack → **Dockerfile**
4. Dockerfile path: `Dockerfile`
5. Exposed port: `3000`
6. Health check path: `/api/health`

### 4. Set environment variables

Add all variables from the table above. Minimum for Phase 1a:
- `DATABASE_URL` (from step 1)
- `REDIS_URL` (from step 2)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

### 5. Set post-deploy command

In app settings → Post-deploy command:
```
npx prisma migrate deploy
```

### 6. Deploy

Click Deploy. First build takes 3–5 minutes.

Verify: `curl https://yourdomain.com/api/health` → `{"db":"ok","redis":"ok"}`

---

## GitHub auto-deploy

1. Coolify app settings → Source → enable **Auto deploy on push** → copy the webhook URL
2. GitHub repo → Settings → Webhooks → Add webhook
   - Payload URL: the Coolify webhook URL
   - Content type: `application/json`
   - Events: `Just the push event`

Every push to `main` now triggers an automatic Coolify deploy.

---

## Running migrations

Migrations run automatically via the post-deploy command on Coolify. To run manually:

```bash
# Against a local database
npx prisma migrate dev

# Against production (from CI or a one-off)
npx prisma migrate deploy
```

---

## Phase changelog

| Phase | Deployment changes |
|---|---|
| 1a | Initial setup — Next.js 15, Prisma 5, Redis, health check, Dockerfile, Coolify deploy |
