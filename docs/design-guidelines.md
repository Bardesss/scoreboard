# Dice Vault — Design Guidelines
*Last updated: 2026-04-18*

The single source of truth for visual decisions across Dice Vault. Every component built in this project must match these guidelines. When in doubt, refer here first.

---

## 1. Personality

**Warm Game Night.** Dice Vault feels like a well-loved game table — warm light, friendly competition, a little bit of bragging rights. It is not a bank, not a SaaS dashboard, not a password manager.

- Playful but not childish
- Competitive but not aggressive
- Warm but not soft
- The amber primary colour is the game piece — it pops on every surface

The one thing someone should remember: *it feels like game night, not like software.*

---

## 2. Colour System

### Base tokens (light surfaces)

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#f5a623` | CTA buttons, active states, amber accents, icons on amber backgrounds |
| `primary-dim` | `#e09518` | Hover state for primary buttons |
| `primary-container` | `#fff3d4` | Subtle amber fill behind icons, badge backgrounds |
| `on-primary` | `#1c1408` | Text/icons ON amber primary backgrounds |
| `surface` | `#f7f3ed` | Page body background — warm cream |
| `surface-container-lowest` | `#fefcf8` | Card backgrounds, auth card, modal |
| `surface-container-low` | `#f2ece3` | Hover tints, subtle fills |
| `surface-container` | `#ede5d8` | Dividers, chip backgrounds |
| `surface-container-high` | `#e5dccb` | Stronger dividers, borders |
| `surface-container-highest` | `#dbd0bc` | Heaviest surface tint |
| `on-surface` | `#1e1a14` | Primary text — warm near-black |
| `on-surface-variant` | `#6b5e4a` | Secondary text, labels, placeholders |
| `outline` | `#9a8c7a` | Icon-only strokes, input borders |
| `outline-variant` | `#c5b89f` | Subtle dividers, underline inputs at rest |
| `inverse-surface` | `#1c1810` | Dark chrome surfaces (sidebar) |
| `error` | `#9f403d` | Destructive actions, error states |

### Dark surfaces (sidebar)

Used on `inverse-surface` (`#1c1810`) backgrounds:

| Purpose | Value |
|---|---|
| Text primary | `#f7f3ed` |
| Text secondary | `#9a8878` |
| Text dim | `#4a3f2f` |
| Amber accent fills | `rgba(245,166,35,0.12)` |
| Amber accent borders | `rgba(245,166,35,0.2)` |
| Hover fill | `rgba(245,166,35,0.06)` |
| Dividers | `rgba(245,166,35,0.08)` |

### Landing page (extra dark canvas)

The landing page is a distinct dark canvas (`#0b0d12`). Card backgrounds are `#141820`. All colours are specified inline in `page.tsx` via constants — do not use Tailwind tokens on the landing page.

### Amber glow shadows

Always use amber-tinted shadows, never blue or grey:

| Context | Shadow |
|---|---|
| Primary button | `0 4px 14px rgba(245,166,35,0.28)` |
| Logo icon | `0 4px 16px rgba(245,166,35,0.3)` |
| Hero CTA | `0 8px 32px rgba(245,166,35,0.3)` |
| Featured card | `0 8px 32px rgba(245,166,35,0.14)` |

---

## 3. Typography

| Token | Font | Usage |
|---|---|---|
| `font-headline` | Manrope | All headings, labels, buttons, overlines, nav items |
| `font-body` | DM Sans | Body text, descriptions, input text, help text |

Both fonts are loaded from Google Fonts in `src/app/layout.tsx`.

### Scale

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Page headline (h1) | `clamp(38px,5vw,62px)` | Black (900) | `-0.04em` |
| Section headline (h2) | `clamp(28px,4vw,42px)` | Black (900) | `-0.03em` |
| Card title | `17px` | ExtraBold (800) | `-0.02em` |
| Step/item title | `15–16px` | ExtraBold (800) | `-0.02em` |
| Overline | `9.5–10px` | Black (900) | `+0.18em` uppercase |
| Nav label | `13.5px` | SemiBold (600) | default |
| Button | `13–15px` | Bold–ExtraBold | default |
| Body / description | `13–15px` | Regular (400) | default |
| Caption / footnote | `12px` | Regular | default |
| Tiny label | `8.5–9px` | Bold (700) | `+0.1em` uppercase |

---

## 4. Border Radius

| Context | Radius |
|---|---|
| Large cards, modals, CTA blocks | `24px` (`rounded-3xl`) |
| Standard cards, panels | `16px` (`rounded-2xl`) |
| Icon boxes, small cards | `10px` (`rounded-[10px]`) |
| Pill buttons (marketing) | `999px` (`rounded-[999px]`) |
| Square buttons (app) | `10px` (`rounded-[10px]`) |
| Inputs | `0` — underline only |
| Chips / badges | `999px` (`rounded-full`) |
| Avatar | `50%` (`rounded-full`) |

---

## 5. Elevation & Shadows

Use warm-tinted shadows. Never neutral grey or blue.

| Level | Shadow | Usage |
|---|---|---|
| Flat | none | Inline elements |
| Low | `0 2px 16px rgba(30,26,20,0.07)` | Standard cards on light bg |
| Medium | `0 4px 20px rgba(30,26,20,0.09)` | Elevated cards, dropdowns |
| High | `0 8px 28px rgba(30,26,20,0.12)` | Modals, toasts |
| Amber glow | `0 4px 14px rgba(245,166,35,0.28)` | Primary buttons, logo |
| Amber glow strong | `0 8px 32px rgba(245,166,35,0.3)` | Hero CTA, featured cards |

---

## 6. Component Patterns

### Card (light surface)

```tsx
<div
  className="rounded-2xl p-6 transition-all hover:-translate-y-1"
  style={{
    background: '#fefcf8',
    border: '1px solid rgba(245,166,35,0.08)',
    boxShadow: '0 2px 16px rgba(30,26,20,0.07)',
  }}
/>
```

### Card (dark surface — landing)

```tsx
<div
  className="rounded-2xl p-6"
  style={{ background: '#141820', border: '1px solid rgba(245,166,35,0.08)' }}
/>
```

### Primary button

```tsx
<button
  className="px-8 py-3.5 rounded-[10px] bg-primary text-on-primary font-headline font-bold text-[14px] hover:bg-primary-dim transition-all"
  style={{ boxShadow: '0 4px 14px rgba(245,166,35,0.28)' }}
/>
```

### Secondary / ghost button

```tsx
<button
  className="px-8 py-3.5 rounded-[10px] font-headline font-bold text-[14px] transition-all"
  style={{
    background: 'rgba(245,166,35,0.07)',
    border: '1px solid rgba(245,166,35,0.18)',
    color: '#1e1a14',
  }}
/>
```

### Underline input

```tsx
<input
  className="w-full h-11 border-0 border-b border-b-[#c5b89f] focus:border-b-primary rounded-none px-0.5 pb-2.5 font-body text-sm text-on-surface bg-transparent outline-none transition-[border-color] duration-200"
/>
```

Label: `font-headline font-black text-[9px] uppercase tracking-[.15em] text-outline-variant`

### Icon box

```tsx
<div
  className="w-11 h-11 rounded-[10px] flex items-center justify-center"
  style={{ background: 'rgba(245,166,35,0.1)' }}
>
  <SomeIcon size={22} style={{ color: '#f5a623' }} />
</div>
```

### Badge / chip

```tsx
<div
  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
  style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.22)' }}
>
  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f5a623' }} />
  <span
    className="font-headline font-bold text-[11px] uppercase tracking-[.08em]"
    style={{ color: '#f5a623' }}
  >Label</span>
</div>
```

### Overline

```tsx
<p
  className="font-headline font-black text-[10px] uppercase tracking-[.18em] mb-3"
  style={{ color: '#f5a623' }}
>
  Section name
</p>
```

---

## 7. Navigation

### Sidebar (dark chrome)

Background `#1c1810`, width `w-64`, fixed left. Right border `1px solid rgba(245,166,35,0.08)`.

| Element | Style |
|---|---|
| Logo icon | `#f5a623` bg, `#1c1408` icon, amber glow shadow |
| Logo text | `#f7f3ed` |
| Credit chip | `rgba(245,166,35,0.1)` fill, amber border, amber dot + text |
| Active nav | `rgba(245,166,35,0.12)` fill, amber text, inset amber border |
| Inactive nav | `#9a8878` text; hover → `rgba(245,166,35,0.06)` + `#f7f3ed` |
| User avatar | `#f5a623` bg, `#1c1408` initials |

### Header — light (auth / marketing)

`rgba(247,243,237,0.88)` frosted glass, amber border bottom, amber logo icon, amber register CTA.

### Header — dark (landing page only)

`rgba(11,13,18,0.88)` frosted glass, same amber accents. Auto-detected via `usePathname()`.

### Bottom nav (mobile)

`rgba(247,243,237,0.94)` frosted glass, amber top border, amber active icon/label.

---

## 8. Background Texture

Global dot grid:

```css
background-image: radial-gradient(rgba(245, 166, 35, 0.07) 1px, transparent 1px);
background-size: 28px 28px;
```

Landing page override (in `globals.css`):

```css
body:has(.landing-page)::before {
  background-image: radial-gradient(rgba(245, 166, 35, 0.05) 1px, transparent 1px);
}
```

---

## 9. Game-specific Elements

### Dice face decoration

Ambient decorative element for hero sections. See `DieFace` component in `src/app/[locale]/page.tsx`.
- Opacity: `0.07–0.14` (always subtle)
- Slight rotation: `±8–17°`
- Colour: amber (`#f5a623`) dots, amber border
- Only on large-screen breakpoints (`hidden md:block`)

### Score / large number display

```tsx
<div
  className="font-headline font-black leading-none tracking-[-0.04em]"
  style={{ fontSize: 72, color: '#f5a623', textShadow: '0 0 48px rgba(245,166,35,0.35)' }}
>
  75
</div>
```

The amber glow makes large numbers feel like a scoreboard, not a spreadsheet.

---

## 10. Do's and Don'ts

### Do
- Use amber (`#f5a623`) as the single accent — one colour, used consistently
- Give all CTA buttons and logo icons warm amber glow shadows
- Use `font-headline` (Manrope) for everything interactive: buttons, nav, labels, headings
- Keep cards slightly lifted with a warm shadow — never flat white on white
- Use warm surface tones (`#f7f3ed`, `#fefcf8`) instead of pure white or cold grey
- Use the dark sidebar as the one "game table" element in the authenticated app

### Don't
- **No cold blue** — `rgba(0,91,192,...)`, `#005bc0`, `#3b82f6` are banned
- **No `#ffffff` body backgrounds** — use `surface` (`#f7f3ed`) or `surface-container-lowest` (`#fefcf8`)
- **No purple gradients** — Dice Vault uses zero purple
- **No neutral grey shadows** — all shadows carry warm or amber tint
- **No Inter, Roboto, or system-ui fonts** — Manrope for headlines, DM Sans for body, nothing else
- **No flat cards without shadow or border** — always one of the two
- **No hardcoded blue hex values** in components — use Tailwind tokens or amber values

---

## 11. File Map

| File | Role |
|---|---|
| `tailwind.config.js` | All colour tokens — source of truth for the light design system |
| `src/app/globals.css` | Body background, dot grid, landing page dark overrides |
| `src/app/[locale]/page.tsx` | Landing page — inline constants, not Tailwind tokens |
| `src/components/layout/Header.tsx` | Dual-mode header (dark landing / warm auth) |
| `src/components/layout/Footer.tsx` | Dual-mode footer |
| `src/components/layout/Sidebar.tsx` | Dark warm chrome sidebar |
| `src/components/layout/MobileHeader.tsx` | Warm amber mobile header |
| `src/components/layout/BottomNav.tsx` | Warm amber bottom navigation |
| `src/components/auth/AuthCard.tsx` | Auth card + `UnderlineInput` + `PrimaryButton` |
| `src/components/layout/CookieBanner.tsx` | Cookie consent — warm surface |
