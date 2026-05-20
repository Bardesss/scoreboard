# Hide Billing Sections Until a Payment Provider Is Live — Design

**Date:** 2026-05-20
**Status:** Approved

## Problem

The public landing page shows two billing-related sections — **Credit Packs** (with the
"Beschikbaar zodra facturatie aanstaat" badge) and **Payment Options** ("Betaalopties").
No payment provider is currently configured (payments are a parked phase), so these
sections advertise something that cannot be acted on. They should be hidden until a real
payment provider is live, and reappear automatically once one is.

## Decision

Hide **both whole sections** while no payment provider is enabled. A provider counts as
"enabled" only when its `Integration` row exists with `status: 'ok'` — configured *and*
its connection test passed. A provider that is saved but failing (`status: 'error'`) or
not yet configured (`status: 'unconfigured'`) does not count.

## Approach

Approach A (chosen): query the existing `Integration` table.

Rejected alternatives:
- **Manual `AdminSettings` toggle** — needs a new admin UI switch and can drift from
  reality (flag on while the provider is actually broken).
- **Hide unconditionally** — loses the automatic reveal when a provider goes live.

Approach A is forward-compatible: the sections stay hidden now and reappear the moment
phase 11a configures and successfully tests a Mollie/Stripe/Strike provider — no code
change or admin busywork required at that point.

## Components

### 1. `hasActivePaymentProvider()` — `src/lib/integrations.ts`

New exported function:

```ts
export async function hasActivePaymentProvider(): Promise<boolean> {
  const count = await prisma.integration.count({
    where: { provider: { in: ['mollie', 'stripe', 'strike'] }, status: 'ok' },
  })
  return count > 0
}
```

`mailgun` (the only currently-used provider, for email) is deliberately excluded — it is
not a payment provider. The `Integration` model already has `@@index([status])`, so this
is a single cheap indexed count; it runs per landing-page request with no caching.

### 2. Landing page — `src/app/[locale]/(marketing)/page.tsx`

The page is an async server component. Add, alongside the existing
`const freeMode = await loadFreeModeState()`:

```ts
const billingEnabled = await hasActivePaymentProvider()
```

Wrap the existing `{/* ── Credit Packs ── */}` `<section>` and the
`{/* ── Payment Options ── */}` `<section>` each in `{billingEnabled && ( … )}`.

Everything inside those sections is unchanged. The `freeMode.active` branch of the
Credit Packs overline stays as-is — it still applies in the narrow case where a provider
is enabled while free mode is also running. The `packs` and `paymentMethods` data arrays
stay built from translations even when the sections are hidden (cheap; not worth
conditionalizing).

When both sections are hidden the page flows Credits → Reviews directly; no layout
adjustment is needed (the Payment Options section's distinct dark background is fully
contained within its own `<section>`).

## Testing

- Unit-test `hasActivePaymentProvider` in `src/lib/integrations.test.ts`: mock
  `prisma.integration.count` → returns `true` when count > 0, `false` when count is 0;
  assert the `where` filter targets the three payment providers and `status: 'ok'`.
- The conditional render is verified by `npx tsc --noEmit`, consistent with the codebase
  having no React component render tests.

## Out of Scope (YAGNI)

- Per-provider granularity (showing only the section relevant to the live provider).
- Caching the provider check.
- Any change to free-mode logic or the section contents.
