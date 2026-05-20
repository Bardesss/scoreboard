# Toast Restyle — Design

**Date:** 2026-05-20
**Status:** Approved

## Problem

The app's `sonner` toasts have an **invisible background** and sit at `bottom-center`,
which is poor UX. Root causes:

1. `src/components/ui/sonner.tsx` sets `--normal-bg: var(--popover)`. `globals.css`
   defines `--popover` as a raw shadcn HSL triplet (`0 0% 100%`), not a full colour.
   Sonner uses `--normal-bg` directly as a CSS colour, so `background: 0 0% 100%` is
   invalid and no background renders.
2. `position="bottom-center"` in `src/app/layout.tsx` places toasts where the user does
   not want them.
3. `toastOptions.classNames.toast: "cn-toast"` references a class with no CSS rules
   anywhere — a dead no-op.
4. `sonner.tsx` calls `useTheme()` from `next-themes`, but the app has no `ThemeProvider`
   (it uses its own CSS-based theme system), so the hook always yields the `"system"`
   default and does nothing useful.

## Decisions

- **Placement:** `top-center` — works on both mobile and desktop, never collides with
  bottom-of-page actions.
- **Style:** solid colour per toast type (green success, red error, amber warning, blue
  info) — high contrast on both the warm-light `/app` theme and the dark `/admin` theme,
  theme-independent.

## Approach

Approach A (chosen): use sonner's built-in `richColors` prop for the per-type solid
colours, and wrap the shadcn vars in `hsl()` for the neutral/default toast.

Rejected: hand-rolling per-type colours via CSS targeting `[data-type="..."]` selectors —
more CSS to own and keep in sync across sonner versions, with no benefit over the
built-in `richColors`.

## Components

### 1. `src/components/ui/sonner.tsx`

- Add the `richColors` prop to `<Sonner>` — gives typed toasts (success / error /
  warning / info) solid opaque backgrounds with matching text and border.
- Fix the CSS custom properties so the neutral/default toast (plain `toast()` and
  `loading` toasts, which `richColors` does not recolour) renders a visible surface:
  - `--normal-bg`: `var(--popover)` → `hsl(var(--popover))`
  - `--normal-text`: `var(--popover-foreground)` → `hsl(var(--popover-foreground))`
  - `--normal-border`: `var(--border)` → `hsl(var(--border))`
  - `--border-radius`: `var(--radius)` — unchanged (`--radius` is already a valid length).
- Remove the `useTheme()` call and the `next-themes` import; pass `theme="light"`
  explicitly to `<Sonner>` instead.
- Remove the `toastOptions={{ classNames: { toast: "cn-toast" } }}` config (dead no-op).
- Keep the existing custom lucide `icons` map unchanged.

### 2. `src/app/layout.tsx`

- Change `<Toaster position="bottom-center" />` to `<Toaster position="top-center" />`.

## Out of Scope (YAGNI)

- Removing `next-themes` from `package.json` — it becomes an unused dependency, but
  removing it touches the lockfile; left for a separate cleanup.
- Per-route (app vs admin) toast theming — `richColors` is theme-independent, so one
  global style is sufficient.
- Changing any individual `toast(...)` call site (21 files import `toast`); only the
  global `<Toaster>` configuration changes.

## Testing

Pure styling/config change. Verified by `npx tsc --noEmit` and a manual check that a
success and an error toast render with a visible solid colour at top-center. Consistent
with the codebase having no React component render tests.
