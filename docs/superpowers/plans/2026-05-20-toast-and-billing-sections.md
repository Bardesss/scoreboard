# Toast Restyle + Hide Billing Sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two independent landing/UX fixes — make `sonner` toasts visible and well-placed, and hide the landing page's billing sections until a payment provider is actually live.

**Architecture:** Toast fix is pure config in the global `<Toaster>` (sonner's `richColors` + an `hsl()` wrapping fix + `top-center`). Billing-section hide adds a `hasActivePaymentProvider()` helper that counts `Integration` rows with `status: 'ok'`, and conditionally renders two `<section>` blocks on the (already dynamic) marketing page.

**Tech Stack:** Next.js 15 App Router, React 19, `sonner`, Prisma, Vitest.

**Specs:**
- `docs/superpowers/specs/2026-05-20-toast-restyle-design.md`
- `docs/superpowers/specs/2026-05-20-hide-billing-sections-design.md`

---

## File Structure

**Modify:**
- `src/components/ui/sonner.tsx` — global `<Toaster>` config: `richColors`, `hsl()` var fix, drop `next-themes`/`cn-toast`
- `src/app/layout.tsx` — toast `position`
- `src/lib/integrations.ts` — add `hasActivePaymentProvider()`
- `src/lib/integrations.test.ts` — add `count` to the prisma mock + tests for the new helper
- `src/app/[locale]/(marketing)/page.tsx` — fetch `billingEnabled`, conditionally render two sections

The two features are independent: Task 1 is the toast fix; Tasks 2–3 are the billing-section hide. They share no code.

---

## Task 1: Restyle and reposition toasts

Pure styling/config — no unit test (the codebase has no React component render tests; Vitest runs in the `node` environment). Verified by type-check.

**Files:**
- Modify: `src/components/ui/sonner.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace the `Toaster` component**

Replace the entire contents of `src/components/ui/sonner.tsx` with:

```tsx
"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
```

This changes four things vs. the current file: adds `richColors`; wraps the three `--normal-*` vars in `hsl()` (the shadcn vars are raw HSL triplets, so the un-wrapped form produced an invalid `background` value and an invisible toast); replaces the `useTheme()`/`next-themes` import with an explicit `theme="light"`; and drops the dead `toastOptions={{ classNames: { toast: "cn-toast" } }}` (the `cn-toast` class has no CSS rules anywhere).

- [ ] **Step 2: Move the toaster to top-center**

In `src/app/layout.tsx`, change:

```tsx
        <Toaster position="bottom-center" />
```

to:

```tsx
        <Toaster position="top-center" />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `sonner.tsx` or `layout.tsx`. (The project has pre-existing unrelated errors in some `src/test/*.test.ts` files — ignore those.) In particular there must be no "Cannot find module 'next-themes'" or unused-import error.

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Trigger any toast (e.g. save something in `/app/settings`). Confirm: it appears at the top-center of the viewport; a success toast has a solid green background, an error toast a solid red background; the text and icon are clearly legible (no invisible/transparent background).

- [ ] **Step 5: Commit**

```
git add src/components/ui/sonner.tsx src/app/layout.tsx
git commit -m "fix(ui): visible richColors toasts at top-center"
```

---

## Task 2: `hasActivePaymentProvider()` helper

**Files:**
- Modify: `src/lib/integrations.ts`
- Test: `src/lib/integrations.test.ts`

This is a TDD task.

- [ ] **Step 1: Add `count` to the prisma mock and write the failing tests**

In `src/lib/integrations.test.ts`, the file begins with a `vi.mock('@/lib/prisma', ...)` block. Add `count: vi.fn()` to the `integration` mock. Change:

```ts
vi.mock('@/lib/prisma', () => ({
  prisma: {
    integration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}))
```

to:

```ts
vi.mock('@/lib/prisma', () => ({
  prisma: {
    integration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}))
```

Then append this new `describe` block to the end of the file:

```ts
describe('hasActivePaymentProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when no payment provider has status ok', async () => {
    vi.mocked(prisma.integration.count).mockResolvedValue(0)
    const { hasActivePaymentProvider } = await import('./integrations')
    expect(await hasActivePaymentProvider()).toBe(false)
  })

  it('returns true when at least one payment provider has status ok', async () => {
    vi.mocked(prisma.integration.count).mockResolvedValue(1)
    const { hasActivePaymentProvider } = await import('./integrations')
    expect(await hasActivePaymentProvider()).toBe(true)
  })

  it('counts only the three payment providers with status ok', async () => {
    vi.mocked(prisma.integration.count).mockResolvedValue(0)
    const { hasActivePaymentProvider } = await import('./integrations')
    await hasActivePaymentProvider()
    expect(prisma.integration.count).toHaveBeenCalledWith({
      where: { provider: { in: ['mollie', 'stripe', 'strike'] }, status: 'ok' },
    })
  })
})
```

(`prisma` is already imported at the top of this test file; `describe`/`it`/`expect`/`vi`/`beforeEach` are already imported on line 1.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/integrations.test.ts`
Expected: FAIL — `hasActivePaymentProvider` is not exported from `./integrations`.

- [ ] **Step 3: Implement the helper**

Append to the end of `src/lib/integrations.ts`:

```ts
/**
 * True when at least one payment provider (Mollie / Stripe / Strike) is
 * configured and has passed its connection test (status 'ok'). Mailgun is
 * excluded — it is an email provider, not a payment provider.
 */
export async function hasActivePaymentProvider(): Promise<boolean> {
  const count = await prisma.integration.count({
    where: { provider: { in: ['mollie', 'stripe', 'strike'] }, status: 'ok' },
  })
  return count > 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/integrations.test.ts`
Expected: PASS — all tests in the file, including the 3 new ones.

Also run `npx tsc --noEmit` and confirm no new errors in `integrations.ts` / `integrations.test.ts`.

- [ ] **Step 5: Commit**

```
git add src/lib/integrations.ts src/lib/integrations.test.ts
git commit -m "feat(integrations): add hasActivePaymentProvider check"
```

---

## Task 3: Hide the billing sections on the landing page

The marketing page is an `async` server component with no render test in this codebase, so this task is verified by type-check.

**Files:**
- Modify: `src/app/[locale]/(marketing)/page.tsx`

- [ ] **Step 1: Import the helper**

In `src/app/[locale]/(marketing)/page.tsx`, the imports currently include (around line 9):

```ts
import { getHeroMedia } from '@/lib/heroMedia'
```

Add immediately after it:

```ts
import { hasActivePaymentProvider } from '@/lib/integrations'
```

- [ ] **Step 2: Fetch `billingEnabled`**

In the same file, find this line (around line 87):

```ts
  const heroMedia = await getHeroMedia()
```

Add immediately after it:

```ts
  const billingEnabled = await hasActivePaymentProvider()
```

- [ ] **Step 3: Wrap the Credit Packs section**

Find this exact block:

```tsx
      {/* ── Credit Packs ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
```

Replace it with:

```tsx
      {/* ── Credit Packs (hidden until a payment provider is live) ── */}
      {billingEnabled && (
      <section className="max-w-5xl mx-auto px-6 py-20">
```

(Do NOT re-indent the section body — leave its inner lines exactly as they are. JSX ignores indentation; re-indenting only adds diff noise.)

- [ ] **Step 4: Close the Credit Packs wrapper and open the Payment Options wrapper**

Find this exact block (the Credit Packs section's closing tag, a blank line, then the Payment Options comment and opening tag):

```tsx
      </section>

      {/* ── Payment Options ── */}
      <section className="py-20" style={{ background: '#0f1117' }}>
```

Replace it with:

```tsx
      </section>
      )}

      {/* ── Payment Options (hidden until a payment provider is live) ── */}
      {billingEnabled && (
      <section className="py-20" style={{ background: '#0f1117' }}>
```

- [ ] **Step 5: Close the Payment Options wrapper**

Find this exact block (the Payment Options section's closing tag, a blank line, then the Reviews comment):

```tsx
      </section>

      {/* ── Reviews ── */}
```

Replace it with:

```tsx
      </section>
      )}

      {/* ── Reviews ── */}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `page.tsx`. (Pre-existing unrelated `src/test/*.test.ts` errors — ignore.) A JSX-structure mistake (unbalanced `{billingEnabled && (` / `)}`) would surface here as a parse/type error in `page.tsx` — if so, recheck Steps 3–5.

- [ ] **Step 7: Manual verification**

Run `npm run dev` and open the landing page logged out. With no payment provider configured (the current state), the **Credit Packs** and **Payment Options** sections are absent — the page flows from the Credits section straight to Reviews. The rest of the page is unchanged.

- [ ] **Step 8: Commit**

```
git add "src/app/[locale]/(marketing)/page.tsx"
git commit -m "feat(landing): hide billing sections until a payment provider is live"
```

---

## Final Verification

- [ ] **Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (the 3 new `integrations.test.ts` tests included).

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors in any file this plan touched (`sonner.tsx`, `layout.tsx`, `integrations.ts`, `integrations.test.ts`, `page.tsx`).
