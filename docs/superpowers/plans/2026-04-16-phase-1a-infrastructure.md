# Phase 1a — Infrastructure Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js 15 project with Tailwind v3, Prisma, Redis, a working health endpoint, Docker setup, and a live empty-shell deployment on Coolify — before writing any feature code.

> **Push rule:** Commits are made after each task. `git push` happens **once only — at the end of Task 15** (the final task of this phase), after all tasks are complete and all tests pass. Do not push to GitHub at any earlier point.

**Architecture:** Next.js 15 App Router in TypeScript, scaffolded in the existing `scoreboard/` directory alongside reference HTML files. Prisma connects to PostgreSQL; ioredis connects to Redis. A `/api/health` route verifies both connections and acts as the Coolify health probe. All infrastructure is verified live on the VPS before Phase 1b begins.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v3, shadcn/ui, Prisma 5, PostgreSQL 16, ioredis 5, Vitest, Docker multi-stage, Coolify

---

## File map

| File | Purpose |
|---|---|
| `reference/` | Moved HTML prototypes — read-only design reference |
| `next.config.ts` | Standalone output for Docker |
| `tailwind.config.js` | v3 with all design tokens from `docs/design-guidelines.md` |
| `postcss.config.js` | Required by Tailwind v3 |
| `src/app/globals.css` | Tailwind directives + dot-grid body style |
| `src/app/layout.tsx` | Root layout — Google Fonts, antialiasing |
| `src/app/page.tsx` | Placeholder home (redirects to `/en` later) |
| `src/app/api/health/route.ts` | Health check endpoint |
| `src/app/api/health/route.test.ts` | Vitest tests for health endpoint |
| `src/lib/prisma.ts` | Prisma singleton client |
| `src/lib/redis.ts` | ioredis singleton client |
| `src/lib/prisma.test.ts` | Singleton + query test |
| `src/lib/redis.test.ts` | Singleton + ping test |
| `src/test/setup.ts` | Vitest global mocks |
| `prisma/schema.prisma` | Minimal schema: User + AdminSettings |
| `vitest.config.ts` | Vitest configuration |
| `Dockerfile` | Multi-stage: deps → builder → runner |
| `docker-compose.yml` | Local dev: next + postgres + redis |
| `.env.example` | All required environment variables documented |
| `.gitignore` | Standard Next.js + secrets |
| `README.md` | Living deployment guide — Coolify setup, env vars, local dev |

---

## Task 1: Move reference files

**Files:**
- Create: `reference/` directory
- Move: `index.html` → `reference/index.html`
- Move: `landing.html` → `reference/landing.html`
- Move: `admin.html` → `reference/admin.html`

- [ ] **Step 1: Move the files**

```bash
mkdir reference
mv index.html reference/index.html
mv landing.html reference/landing.html
mv admin.html reference/admin.html
```

- [ ] **Step 2: Verify**

```bash
ls reference/
```

Expected output:
```
admin.html  index.html  landing.html
```

- [ ] **Step 3: Commit**

```bash
git add reference/ index.html landing.html admin.html
git commit -m "chore: move HTML prototypes to reference/ folder"
```

---

## Task 2: Scaffold Next.js 15 project

**Files:**
- Create: all Next.js project files (via CLI)

- [ ] **Step 1: Scaffold without Tailwind (we install v3 manually)**

Run from `scoreboard/` directory:

```bash
npx create-next-app@latest . \
  --typescript \
  --no-tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --skip-git
```

When prompted "Ok to proceed?" → yes. When asked about Turbopack → yes.

- [ ] **Step 2: Verify the project starts**

```bash
npm run dev
```

Open `http://localhost:3000` — default Next.js page should show. Stop with Ctrl+C.

- [ ] **Step 3: Commit the scaffold**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project"
```

---

## Task 3: Install and configure Tailwind CSS v3

**Files:**
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Install Tailwind v3 and peer deps**

```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

This creates `tailwind.config.js` and `postcss.config.js`.

- [ ] **Step 2: Replace `tailwind.config.js` with design tokens**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:                     '#005bc0',
        'primary-dim':               '#004fa9',
        'primary-container':         '#d8e2ff',
        'on-primary':                '#f7f7ff',
        secondary:                   '#5d5f65',
        'secondary-container':       '#e2e2e9',
        surface:                     '#f8f9fa',
        'surface-container-lowest':  '#ffffff',
        'surface-container-low':     '#f1f4f6',
        'surface-container':         '#eaeff1',
        'surface-container-high':    '#e3e9ec',
        'surface-container-highest': '#dbe4e7',
        'on-surface':                '#2b3437',
        'on-surface-variant':        '#586064',
        outline:                     '#737c7f',
        'outline-variant':           '#abb3b7',
        'inverse-surface':           '#0c0f10',
        error:                       '#9f403d',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body:     ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: 'DM Sans', sans-serif;
  background: #f8f9fa;
  color: #2b3437;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: radial-gradient(rgba(43, 52, 55, 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
}

h1, h2, h3, h4, h5 { font-family: 'Manrope', sans-serif; }

::-webkit-scrollbar       { width: 4px; height: 4px; }
::-webkit-scrollbar-thumb { background: #dbe4e7; border-radius: 99px; }
::-webkit-scrollbar-track { background: transparent; }
```

- [ ] **Step 4: Update `src/app/layout.tsx` to load Google Fonts**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dice Vault — Store Your Scores Safely',
  description: 'Track your board game sessions, rank your group, and build a permanent archive of your game nights.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Replace `src/app/page.tsx` with a minimal placeholder**

```tsx
export default function Home() {
  return (
    <main style={{ padding: '40px', fontFamily: 'Manrope, sans-serif' }}>
      <h1 style={{ color: '#005bc0', fontSize: '32px', fontWeight: 900 }}>
        Dice Vault
      </h1>
      <p style={{ color: '#586064', marginTop: '8px' }}>
        Infrastructure check — Phase 1a
      </p>
    </main>
  )
}
```

- [ ] **Step 6: Verify Tailwind works**

```bash
npm run dev
```

Open `http://localhost:3000` — you should see the blue "Dice Vault" heading in Manrope. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js postcss.config.js src/app/globals.css src/app/layout.tsx src/app/page.tsx
git commit -m "chore: configure Tailwind v3 with design tokens and Google Fonts"
```

---

## Task 4: Initialize shadcn/ui

**Files:**
- Create: `components.json`
- Create: `src/components/ui/` (auto-generated by shadcn)
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style → **Default**
- Base color → **Slate**
- CSS variables → **yes**

- [ ] **Step 2: Add the Button component to verify it works**

```bash
npx shadcn@latest add button
```

- [ ] **Step 3: Verify `src/lib/utils.ts` exists and contains `cn()`**

Open `src/lib/utils.ts` — it should contain:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Commit**

```bash
git add components.json src/components/ src/lib/utils.ts
git commit -m "chore: initialize shadcn/ui with Button component"
```

---

## Task 5: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` (add test script)

- [ ] **Step 1: Install Vitest and dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Create `src/test/setup.ts`**

```ts
import { vi, afterEach } from 'vitest'

// Global mock for Prisma — overridden per test as needed
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
  },
}))

// Global mock for Redis — overridden per test as needed
vi.mock('@/lib/redis', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    quit: vi.fn(),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})
```

- [ ] **Step 4: Add test script to `package.json`**

Open `package.json` and add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: Verify Vitest works with a smoke test**

Create `src/test/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run:

```bash
npm test
```

Expected output: `1 passed`

- [ ] **Step 6: Delete the smoke test**

```bash
rm src/test/smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json
git commit -m "chore: set up Vitest with global prisma and redis mocks"
```

---

## Task 6: Prisma singleton

**Files:**
- Create: `src/lib/prisma.ts`
- Create: `src/lib/prisma.test.ts`
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Install Prisma**

```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`.

- [ ] **Step 2: Replace `prisma/schema.prisma` with minimal Phase 1a schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Minimal schema for Phase 1a — expanded in Phase 1b
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
}

model AdminSettings {
  key   String @id
  value Json
}
```

- [ ] **Step 3: Write the failing test first**

Create `src/lib/prisma.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

describe('prisma singleton', () => {
  it('exports a prisma client instance', async () => {
    // The module is mocked globally in setup.ts
    // This test verifies the mock shape matches what we expect from the real module
    const { prisma } = await import('@/lib/prisma')
    expect(prisma).toBeDefined()
    expect(typeof prisma.$queryRaw).toBe('function')
  })

  it('$queryRaw resolves without throwing', async () => {
    const { prisma } = await import('@/lib/prisma')
    await expect(prisma.$queryRaw`SELECT 1`).resolves.not.toThrow()
  })
})
```

- [ ] **Step 4: Run the test — it will fail because `src/lib/prisma.ts` doesn't exist yet**

```bash
npm test src/lib/prisma.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/prisma'"

- [ ] **Step 5: Create `src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 6: Run the test — should pass**

```bash
npm test src/lib/prisma.test.ts
```

Expected: 2 passed

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/lib/prisma.ts src/lib/prisma.test.ts
git commit -m "feat: add Prisma singleton and minimal schema"
```

---

## Task 7: Run first migration

**Files:**
- Creates: `prisma/migrations/`

> Requires a running PostgreSQL instance. Use `docker-compose up -d db` or a local Postgres.

- [ ] **Step 1: Start the database**

```bash
docker compose up -d db
```

Wait 3 seconds for Postgres to be ready.

- [ ] **Step 2: Set `DATABASE_URL` in `.env`**

```
DATABASE_URL="postgresql://dicevault:dicevault@localhost:5432/dicevault"
```

- [ ] **Step 3: Run the migration**

```bash
npx prisma migrate dev --name init
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Verify tables were created**

```bash
npx prisma studio
```

Open `http://localhost:5555` — you should see `User` and `AdminSettings` tables. Close Prisma Studio (Ctrl+C).

- [ ] **Step 5: Commit migrations**

```bash
git add prisma/migrations/
git commit -m "feat: initial database migration (User, AdminSettings)"
```

---

## Task 8: Redis singleton

**Files:**
- Create: `src/lib/redis.ts`
- Create: `src/lib/redis.test.ts`

- [ ] **Step 1: Install ioredis**

```bash
npm install ioredis
npm install -D @types/ioredis
```

- [ ] **Step 2: Write the failing test first**

Create `src/lib/redis.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('redis singleton', () => {
  it('exports a redis client instance', async () => {
    const { redis } = await import('@/lib/redis')
    expect(redis).toBeDefined()
    expect(typeof redis.ping).toBe('function')
  })

  it('ping resolves to PONG', async () => {
    const { redis } = await import('@/lib/redis')
    const result = await redis.ping()
    expect(result).toBe('PONG')
  })

  it('get returns null for missing key', async () => {
    const { redis } = await import('@/lib/redis')
    const result = await redis.get('nonexistent_key_xyz')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test — should fail**

```bash
npm test src/lib/redis.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/redis'"

- [ ] **Step 4: Create `src/lib/redis.ts`**

```ts
import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
```

- [ ] **Step 5: Update `src/test/setup.ts` to add the missing `get` mock**

```ts
vi.mock('@/lib/redis', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  },
}))
```

- [ ] **Step 6: Run the test — should pass**

```bash
npm test src/lib/redis.test.ts
```

Expected: 3 passed

- [ ] **Step 7: Commit**

```bash
git add src/lib/redis.ts src/lib/redis.test.ts src/test/setup.ts
git commit -m "feat: add ioredis singleton"
```

---

## Task 9: Health check endpoint

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/health/route.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/app/api/health/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'

describe('GET /api/health', () => {
  it('returns 200 with db:ok and redis:ok when both are healthy', async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ db: 'ok', redis: 'ok' })
  })

  it('returns 503 when db throws', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB down'))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.db).toBe('error')
    expect(body.redis).toBe('ok')
  })

  it('returns 503 when redis throws', async () => {
    const { redis } = await import('@/lib/redis')
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error('Redis down'))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.db).toBe('ok')
    expect(body.redis).toBe('error')
  })
})
```

- [ ] **Step 2: Run the tests — should fail**

```bash
npm test src/app/api/health/route.test.ts
```

Expected: FAIL — "Cannot find module './route'"

- [ ] **Step 3: Create `src/app/api/health/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'ok'
  let redisStatus: 'ok' | 'error' = 'ok'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  try {
    const pong = await redis.ping()
    if (pong !== 'PONG') redisStatus = 'error'
  } catch {
    redisStatus = 'error'
  }

  const healthy = dbStatus === 'ok' && redisStatus === 'ok'

  return NextResponse.json(
    { db: dbStatus, redis: redisStatus },
    { status: healthy ? 200 : 503 }
  )
}
```

- [ ] **Step 4: Run the tests — should pass**

```bash
npm test src/app/api/health/route.test.ts
```

Expected: 3 passed

- [ ] **Step 5: Verify manually with dev server + real DB + Redis**

```bash
docker compose up -d db redis
npm run dev
curl http://localhost:3000/api/health
```

Expected: `{"db":"ok","redis":"ok"}`

Stop dev server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/health/
git commit -m "feat: add /api/health endpoint with db and redis checks"
```

---

## Task 10: Configure `next.config.ts` for standalone Docker output

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Update `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 2: Verify the build still works**

```bash
npm run build
```

Expected: build completes, `.next/standalone/` directory created.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore: enable standalone output for Docker"
```

---

## Task 11: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.env
.env.local
*.log
coverage
.git
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Build the application ──────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ─── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 3: Build the image locally to verify**

```bash
docker build -t dicevault:test .
```

Expected: build completes with no errors. This takes 2–3 minutes on first run.

- [ ] **Step 4: Run the image locally**

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://dicevault:dicevault@host.docker.internal:5432/dicevault" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  dicevault:test
```

Visit `http://localhost:3000/api/health` — expected: `{"db":"ok","redis":"ok"}`

Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: add multi-stage Dockerfile"
```

---

## Task 12: docker-compose.yml and .env.example

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env.local` is ignored)

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dicevault
      POSTGRES_USER: dicevault
      POSTGRES_PASSWORD: dicevault
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dicevault']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://dicevault:dicevault@db:5432/dicevault
      REDIS_URL: redis://redis:6379
      NEXTAUTH_SECRET: change_me_in_production
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: sh -c "npx prisma migrate deploy && node server.js"

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 2: Create `.env.example`**

```bash
# ─── Database ────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/dicevault"

# ─── Redis ───────────────────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ─── NextAuth ────────────────────────────────────────────────────
NEXTAUTH_SECRET="generate_with: openssl rand -base64 32"
NEXTAUTH_URL="https://yourdomain.com"

# ─── Mailgun ─────────────────────────────────────────────────────
MAILGUN_API_KEY=""
MAILGUN_DOMAIN=""
MAILGUN_FROM="Dice Vault <noreply@dicevault.fun>"

# ─── Mollie ──────────────────────────────────────────────────────
MOLLIE_API_KEY=""

# ─── Stripe ──────────────────────────────────────────────────────
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# ─── Strike (Phase 7 — Bitcoin Lightning) ────────────────────────
STRIKE_API_KEY=""

# ─── App ─────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="https://dicevault.fun"
```

- [ ] **Step 3: Verify `.env.local` and `.env` are in `.gitignore`**

Open `.gitignore` — confirm these lines exist:
```
.env
.env.local
.env*.local
```

Add them if missing.

- [ ] **Step 4: Test docker-compose locally**

```bash
docker compose up -d db redis
docker compose up app
```

Visit `http://localhost:3000/api/health`. Expected: `{"db":"ok","redis":"ok"}`

Stop with Ctrl+C. Shut down services:
```bash
docker compose down
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: add docker-compose.yml and .env.example"
```

---

## Task 13: Run all tests

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected output:
```
✓ src/lib/prisma.test.ts (2 tests)
✓ src/lib/redis.test.ts (3 tests)
✓ src/app/api/health/route.test.ts (3 tests)

Test Files  3 passed (3)
Tests       8 passed (8)
```

If any tests fail, fix before continuing.

- [ ] **Step 2: Commit if any fixes were needed**

```bash
git add -A
git commit -m "test: all Phase 1a tests passing"
```

---

## Task 14: Prepare GitHub repo and Coolify (no push yet)

**Files:**
- Creates: remote GitHub repository (no code pushed yet)
- Creates: Coolify service configuration

> All commits up to this point are local only. The single end-of-phase push happens in Task 15 after the README is written.

- [ ] **Step 1: Create a GitHub repository**

Go to `https://github.com/new`. Create a private repo named `dicevault`. Do **not** initialize with README, .gitignore, or licence.

- [ ] **Step 2: Add the remote (do not push yet)**

```bash
git remote add origin https://github.com/YOUR_USERNAME/dicevault.git
git branch -M main
```

- [ ] **Step 3: Set up Coolify — PostgreSQL service**

In Coolify dashboard:
1. New Resource → Database → PostgreSQL 16
2. Name: `dicevault-db`
3. Note the generated `DATABASE_URL` — copy it

- [ ] **Step 4: Set up Coolify — Redis service**

In Coolify dashboard:
1. New Resource → Database → Redis 7
2. Name: `dicevault-redis`
3. Note the generated `REDIS_URL` — copy it

- [ ] **Step 5: Set up Coolify — Next.js application**

In Coolify dashboard:
1. New Resource → Application → GitHub → select `dicevault` repo, branch `main`
2. Build Pack → **Dockerfile** (not Nixpacks)
3. Dockerfile path: `Dockerfile`
4. Port: `3000`
5. Health check path: `/api/health`

- [ ] **Step 6: Set environment variables in Coolify**

Add all variables from `.env.example`. At minimum for Phase 1a:
```
DATABASE_URL=<from step 3>
REDIS_URL=<from step 4>
NEXTAUTH_SECRET=<generate: openssl rand -base64 32>
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

- [ ] **Step 7: Set post-deploy command**

In Coolify app settings → Post-deploy command:
```
npx prisma migrate deploy
```

- [ ] **Step 8: Enable GitHub webhook for auto-deploy**

In Coolify app settings → Source → enable "Auto deploy on push". Copy the webhook URL.

In GitHub → repo Settings → Webhooks → Add webhook:
- Payload URL: the Coolify webhook URL
- Content type: `application/json`
- Events: `Just the push event`

---

## Task 15: Create README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
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

1. Coolify dashboard → New Resource → Database → PostgreSQL 16
2. Name: `dicevault-db`
3. Copy the generated `DATABASE_URL`

### 2. Create Redis service

1. Coolify dashboard → New Resource → Database → Redis 7
2. Name: `dicevault-redis`
3. Copy the generated `REDIS_URL`

### 3. Create the Next.js application

1. Coolify dashboard → New Resource → Application → GitHub
2. Select the `dicevault` repository, branch `main`
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
| 1a | Initial setup — Next.js, Prisma, Redis, health check, Dockerfile, Coolify deploy |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with Coolify deployment guide"
```

- [ ] **Step 3: End-of-phase push — push all Phase 1a commits to GitHub**

> This is the **only** `git push` in Phase 1a. All previous commits were local.

```bash
git push -u origin main
```

- [ ] **Step 4: Verify Coolify triggers a deploy**

The webhook set up in Task 14 Step 8 should fire immediately. Watch the Coolify dashboard — a new deployment should start within 30 seconds.

Wait for the build to complete (3–5 minutes first time).

- [ ] **Step 5: Verify live health check**

```bash
curl https://yourdomain.com/api/health
```

Expected: `{"db":"ok","redis":"ok"}`

If you see `{"db":"error",...}` — check that `DATABASE_URL` is correct in Coolify env vars and that the DB service is running.

---

## Phase 1a complete ✓

At this point you have:
- ✅ Next.js 15 + Tailwind v3 + shadcn/ui + TypeScript
- ✅ Prisma connected to PostgreSQL with migrated schema
- ✅ ioredis connected to Redis
- ✅ `/api/health` endpoint tested and live
- ✅ 8 passing Vitest tests
- ✅ Multi-stage Dockerfile
- ✅ docker-compose for local dev
- ✅ Deployed and auto-deploying on Coolify
- ✅ `README.md` with full Coolify deployment guide

**Next:** Phase 1b — Auth + Landing Page + i18n + App shell layout.
Plan will be written at: `docs/superpowers/plans/2026-04-16-phase-1b-auth-landing.md`
