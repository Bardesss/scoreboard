# Phase 6B — Credit Analytics & Tax Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the credit analytics dashboard (`/admin/credits`) with Recharts charts, scaffold the tax export page (`/admin/billing/tax-export`), and finalize the README + INDEX.md.

**Architecture:** Credit analytics is a server page that fetches `CreditTransaction` aggregates and passes them to a client component with Recharts bar and line charts. Tax export queries `CreditPurchase` records (model added in Phase 6A) — until Phase 7 (payments) runs, the page shows an empty state. AdminSidebar links to both pages were already added in Phase 6A.

**Prerequisite:** Phase 6A must be complete and pushed before starting this plan. The `CreditPurchase` and `PricingRegion` schema models were added in Phase 6A Task 1.

**Tech Stack:** Next.js 15 App Router, Prisma 5, Recharts (new install), Vitest

---

## File Map

**New files:**
- `src/app/admin/credits/page.tsx` — credit analytics server page (data fetching)
- `src/app/admin/credits/CreditsClient.tsx` — Recharts charts + user table (client component)
- `src/app/admin/billing/tax-export/page.tsx` — tax export UI (empty state until Phase 7)

**Modified files:**
- `package.json` — recharts added as dependency
- `README.md` — final review: CRON_SECRET env var, Phase 6 changelog entry
- `docs/superpowers/plans/INDEX.md` — mark Phase 6A + 6B done

---

## Task 1: Install Recharts

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

Expected: `recharts` added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify build still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add recharts for credit analytics charts"
```

---

## Task 2: Credit analytics dashboard

**Files:**
- Create: `src/app/admin/credits/page.tsx`
- Create: `src/app/admin/credits/CreditsClient.tsx`

The AdminSidebar already has a `Credits` link pointing to `/admin/credits` (added in Phase 6A Task 7, Step 5).

- [ ] **Step 1: Create the server page**

Create `src/app/admin/credits/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import CreditsClient from './CreditsClient'

export default async function AdminCreditsPage() {
  const [users, transactions, freePeriods, totalSpent] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        monthlyCredits: true,
        permanentCredits: true,
        isLifetimeFree: true,
        creditTransactions: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.creditTransaction.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
      select: { delta: true, pool: true, reason: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.freePeriod.findMany({ orderBy: { startsAt: 'asc' } }),
    prisma.creditTransaction.aggregate({
      _sum: { delta: true },
      where: { delta: { lt: 0 } },
    }),
  ])

  const serializedUsers = users.map(u => ({
    id: u.id,
    email: u.email,
    monthlyCredits: u.monthlyCredits,
    permanentCredits: u.permanentCredits,
    isLifetimeFree: u.isLifetimeFree,
    lastActivity: u.creditTransactions[0]?.createdAt?.toISOString() ?? null,
  }))

  const serializedTransactions = transactions.map(t => ({
    delta: t.delta,
    pool: t.pool,
    reason: t.reason,
    date: t.createdAt.toISOString().split('T')[0],
  }))

  const serializedFreePeriods = freePeriods.map(fp => ({
    startsAt: fp.startsAt.toISOString(),
    endsAt: fp.endsAt.toISOString(),
  }))

  return (
    <CreditsClient
      users={serializedUsers}
      transactions={serializedTransactions}
      freePeriods={serializedFreePeriods}
      totalSpentAllTime={Math.abs(totalSpent._sum.delta ?? 0)}
    />
  )
}
```

- [ ] **Step 2: Create the Recharts client component**

Create `src/app/admin/credits/CreditsClient.tsx`:

```typescript
'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

type Transaction = { delta: number; pool: string; reason: string; date: string }
type UserRow = {
  id: string
  email: string
  monthlyCredits: number
  permanentCredits: number
  isLifetimeFree: boolean
  lastActivity: string | null
}
type FreePeriod = { startsAt: string; endsAt: string }

const card: React.CSSProperties = {
  background: '#161f28',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 24,
}

export default function CreditsClient({
  users,
  transactions,
  freePeriods,
  totalSpentAllTime,
}: {
  users: UserRow[]
  transactions: Transaction[]
  freePeriods: FreePeriod[]
  totalSpentAllTime: number
}) {
  const [tab, setTab] = useState<'overview' | 'users'>('overview')
  const [search, setSearch] = useState('')

  const spentByActionData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {}
    transactions.filter(t => t.delta < 0).forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = {}
      byDate[t.date][t.reason] = (byDate[t.date][t.reason] ?? 0) + Math.abs(t.delta)
    })
    return Object.entries(byDate).slice(-30).map(([date, reasons]) => ({ date, ...reasons }))
  }, [transactions])

  const monthlyLineData = useMemo(() => {
    const byDate: Record<string, { issued: number; spent: number }> = {}
    transactions.forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = { issued: 0, spent: 0 }
      if (t.pool === 'monthly' && t.reason === 'monthly_reset' && t.delta > 0) {
        byDate[t.date].issued += t.delta
      } else if (t.pool === 'monthly' && t.delta < 0) {
        byDate[t.date].spent += Math.abs(t.delta)
      }
    })
    return Object.entries(byDate).slice(-30).map(([date, v]) => ({ date, ...v }))
  }, [transactions])

  const freePeriodDates = useMemo(
    () => freePeriods.map(fp => fp.startsAt.split('T')[0]),
    [freePeriods]
  )

  const filteredUsers = useMemo(
    () => users.filter(u => u.email.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  )

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(245,166,35,0.2)' : 'rgba(255,255,255,0.05)',
    color: active ? '#f5a623' : 'rgba(255,255,255,0.5)',
  })

  const chartTooltipStyle = { background: '#161f28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }
  const axisStyle = { fontSize: 11, fill: 'rgba(255,255,255,0.35)' }
  const gridStyle = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.06)' }
  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '12px 16px',
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)',
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      <h1
        className="font-headline"
        style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4, letterSpacing: '-0.02em' }}
      >
        Credit Analytics
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
        Totaal ooit uitgegeven:{' '}
        <strong style={{ color: 'rgba(255,255,255,0.87)' }}>{totalSpentAllTime} credits</strong>
        {freePeriodDates.length > 0 && (
          <span style={{ marginLeft: 16, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            Gratis periodes: {freePeriodDates.join(', ')}
          </span>
        )}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={tabBtn(tab === 'overview')} onClick={() => setTab('overview')}>Overzicht</button>
        <button style={tabBtn(tab === 'users')} onClick={() => setTab('users')}>Gebruikers ({users.length})</button>
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
              Credits uitgegeven per actie — laatste 30 dagen
            </p>
            {spentByActionData.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>Nog geen transacties.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={spentByActionData}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
                  <Bar dataKey="played_game" name="Played game" fill="#f5a623" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="game_template" name="Game template" fill="#4a8eff" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="league" name="League" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="add_player" name="Add player" fill="#34d399" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={card}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
              Maandelijkse credits — uitgegeven vs. verbruikt (30 dagen)
            </p>
            {monthlyLineData.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>Nog geen maandelijkse resets.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyLineData}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
                  <Line type="monotone" dataKey="issued" name="Uitgegeven (reset)" stroke="#4ade80" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="spent" name="Verbruikt" stroke="#f87171" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op e-mail…"
            style={{
              maxWidth: 400, padding: '9px 14px', marginBottom: 16,
              background: '#161f28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              color: 'rgba(255,255,255,0.87)', fontSize: 13.5, outline: 'none', display: 'block',
            }}
          />
          <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['E-mail', 'Maandelijks', 'Permanent', 'Totaal', 'Flags'].map((h, i) => (
                    <th key={h} className="font-headline" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: 'rgba(255,255,255,0.87)', borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{u.email}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: u.monthlyCredits < 0 ? '#f87171' : 'rgba(255,255,255,0.7)', fontWeight: 600, borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      {u.monthlyCredits}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: 'rgba(255,255,255,0.7)', borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{u.permanentCredits}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: 'rgba(255,255,255,0.87)', fontWeight: 600, borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{u.monthlyCredits + u.permanentCredits}</td>
                    <td style={{ padding: '14px 16px', borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {u.isLifetimeFree && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Lifetime</span>
                        )}
                        {u.monthlyCredits < 0 && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>Negatief</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
                      Geen gebruikers gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any Recharts type errors before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/credits/
git commit -m "feat(admin): credit analytics dashboard — Recharts charts and per-user table"
```

---

## Task 3: Tax export scaffold

**Files:**
- Create: `src/app/admin/billing/tax-export/page.tsx`

The AdminSidebar `Belasting` link pointing to `/admin/billing/tax-export` was added in Phase 6A. The `CreditPurchase` model was added in Phase 6A Task 1. Until Phase 7 adds payment webhooks, `status = 'paid'` records won't exist so the page shows an empty state.

- [ ] **Step 1: Create the tax export page**

Create `src/app/admin/billing/tax-export/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'

type Purchase = {
  id: string
  invoiceNumber: string | null
  createdAt: Date
  customerCountry: string | null
  currency: string
  amountCents: number
  eurAmountCents: number | null
  exchangeRate: unknown
  exchangeRateSource: string | null
  vatTreatment: string | null
  provider: string
}

function vatRate(vatTreatment: string | null): number {
  if (vatTreatment === 'NL_21' || vatTreatment === 'EU_OSS') return 0.21
  return 0
}

function obBox(vatTreatment: string | null): string {
  if (!vatTreatment) return '—'
  if (vatTreatment === 'NL_21') return '1a'
  if (vatTreatment === 'EU_REVERSE_CHARGE') return '3b'
  if (vatTreatment === 'EU_OSS') return '1a (OSS)'
  if (vatTreatment === 'EXPORT') return '3a'
  return '—'
}

function fmtEur(cents: number | null): string {
  if (cents === null) return '—'
  return `€ ${(cents / 100).toFixed(2)}`
}

export default async function TaxExportPage() {
  const purchases = await prisma.creditPurchase.findMany({
    where: { status: 'paid' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, invoiceNumber: true, createdAt: true, customerCountry: true,
      currency: true, amountCents: true, eurAmountCents: true,
      exchangeRate: true, exchangeRateSource: true, vatTreatment: true, provider: true,
    },
  }) as Purchase[]

  // Aggregate per OB box
  const boxes: Record<string, { turnoverCents: number; vatCents: number }> = {}
  for (const p of purchases) {
    const box = obBox(p.vatTreatment)
    const eur = p.eurAmountCents ?? 0
    const rate = vatRate(p.vatTreatment)
    const turnover = Math.round(eur / (1 + rate))
    const vat = eur - turnover
    if (!boxes[box]) boxes[box] = { turnoverCents: 0, vatCents: 0 }
    boxes[box].turnoverCents += turnover
    boxes[box].vatCents += vat
  }

  const thStyle = { textAlign: 'left' as const, padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' as const }

  return (
    <div style={{ maxWidth: 960 }}>
      <h1
        className="font-headline"
        style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4, letterSpacing: '-0.02em' }}
      >
        Belastingexport (OB)
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
        OB-overzicht voor de Belastingdienst. Alle betaalde aankopen, cumulatief.
      </p>

      {purchases.length === 0 ? (
        <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>Nog geen betaalde aankopen.</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
            Gegevens verschijnen hier zodra betalingen worden verwerkt (Fase 7).
          </p>
        </div>
      ) : (
        <>
          {/* OB summary table */}
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Samenvatting OB-vakken</p>
          <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['OB-vak', 'Omschrijving', 'Omzet excl. BTW', 'BTW'].map(h => (
                    <th key={h} className="font-headline" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(boxes).map(([box, { turnoverCents, vatCents }], i, arr) => (
                  <tr key={box}>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.87)', fontWeight: 700, fontSize: 13.5, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{box}</td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13.5, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      {box === '1a' ? 'Binnenlands NL 21%' : box === '3b' ? 'Intra-EU verlegging' : box === '3a' ? 'Export buiten EU' : 'Overig'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13.5, fontWeight: 600, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{fmtEur(turnoverCents)}</td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13.5, fontWeight: 600, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{fmtEur(vatCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed transaction list */}
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Transactieoverzicht</p>
          <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Factuur', 'Datum', 'Land', 'Valuta', 'Bedrag', 'EUR excl. BTW', 'BTW%', 'BTW €', 'OB-vak', 'Methode'].map(h => (
                      <th key={h} className="font-headline" style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p, i) => {
                    const rate = vatRate(p.vatTreatment)
                    const eur = p.eurAmountCents ?? 0
                    const turnover = Math.round(eur / (1 + rate))
                    const vat = eur - turnover
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13, whiteSpace: 'nowrap', borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.invoiceNumber ?? '—'}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, whiteSpace: 'nowrap', borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.createdAt.toLocaleDateString('nl-NL')}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.customerCountry ?? '—'}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.currency}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{(p.amountCents / 100).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{fmtEur(turnover)}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{(rate * 100).toFixed(0)}%</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{fmtEur(vat)}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{obBox(p.vatTreatment)}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, textTransform: 'capitalize', borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.provider}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 24, lineHeight: 1.6 }}>
            Dit rapport converteert alle betalingen (inclusief Bitcoin) naar euro&apos;s zoals vereist door de Belastingdienst.
            Controleer altijd wisselkoersen en bewaar bewijs van de gebruikte koersen.
            Voor crypto: documenteer de marktwaarde op het moment van facturering of betaling.
            Dit is geen officieel belastingadvies.
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/billing/
git commit -m "feat(admin): tax export scaffold — OB summary and transaction list, empty until Phase 7"
```

---

## Task 4: Full test suite + README + INDEX.md + push

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS. Fix any failures before proceeding.

- [ ] **Step 2: TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Update README.md**

In `README.md`, find the environment variables table and add:

```markdown
| `CRON_SECRET` | Required | Any random string — used to authenticate the `/api/cron/credit-reset` endpoint | Phase 6A |
```

In the Phase changelog section, add:

```markdown
- Phase 6A: Support ticket system, monthly credit reset cron (`CRON_SECRET` required), `requiresMfa` enforcement, low-credit warning emails
- Phase 6B: Credit analytics dashboard (`/admin/credits`), tax export scaffold (`/admin/billing/tax-export`)
```

- [ ] **Step 4: Update INDEX.md**

In `docs/superpowers/plans/INDEX.md`, update the Phase 6 rows:

```markdown
| **6A** | [phase-6a-tickets-cron.md](2026-04-22-phase-6a-tickets-cron.md) | done | Support tickets, cron, requiresMfa, low-credit warnings |
| **6B** | [phase-6b-analytics-taxexport.md](2026-04-22-phase-6b-analytics-taxexport.md) | done | Credit analytics, tax export scaffold, README final review |
```

Remove the old Phase 6 row if it still exists.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/plans/INDEX.md
git commit -m "docs: mark Phase 6A + 6B done, update README with CRON_SECRET"
```

- [ ] **Step 6: Push to main**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Credit analytics dashboard (`/admin/credits`) — bar chart (credits spent by action), line chart (monthly issued vs spent), per-user table with flags
- ✅ Free periods shown as annotations on charts (start dates listed in subtitle)
- ✅ Tax export scaffold (`/admin/billing/tax-export`) — full OB summary + transaction detail, empty state until Phase 7
- ✅ README updated with CRON_SECRET env var
- ✅ INDEX.md updated, both phases marked done

**Deferred to Phase 7 (payments):**
- ECB/Coinbase exchange rate fetching (fires in payment webhook)
- Sequential invoice numbers (DV-YYYY-NNNN) assigned in webhook
- VAT treatment auto-assignment in webhook
- Mollie/Stripe/Strike webhook handlers
- CSV download button for tax export (meaningful only once data exists)
