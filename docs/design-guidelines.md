# Dice Vault — Design Guidelines
*Extracted from reference/index.html, reference/landing.html, reference/admin.html*

Every component built in this project must match these guidelines exactly. When in doubt, open the reference file in a browser and compare.

---

## 1. Themes

Two distinct themes exist. Never mix them.

| | App + Landing | Admin |
|---|---|---|
| Background | `#f8f9fa` | `#0c0f10` |
| Sidebar | `white` | `#131c24` |
| Cards | `white` | `#161f28` |
| Body text | `#2b3437` | `rgba(255,255,255,0.87)` |
| Muted text | `#586064` | `rgba(255,255,255,0.45)` |
| Very muted | `#abb3b7` | `rgba(255,255,255,0.30)` |
| Borders | `#eaeff1` | `rgba(255,255,255,0.07)` |
| Dot grid dots | `rgba(43,52,55,0.04)` | `rgba(255,255,255,0.04)` |

---

## 2. Color tokens

```css
/* Primary */
--primary:           #005bc0
--primary-dim:       #004fa9
--primary-container: #d8e2ff    /* tinted bg for icon wrappers */
--on-primary:        #f7f7ff    /* text on primary bg */

/* On dark surfaces — primary must be lightened */
--primary-on-dark:   #4a8eff    /* used in admin active states, dark card accents */

/* Surface (light theme) */
--surface:                    #f8f9fa
--surface-container-lowest:   #ffffff
--surface-container-low:      #f1f4f6
--surface-container:          #eaeff1
--surface-container-high:     #e3e9ec
--surface-container-highest:  #dbe4e7

/* Text (light theme) */
--on-surface:         #2b3437
--on-surface-variant: #586064
--outline:            #737c7f
--outline-variant:    #abb3b7
--placeholder:        #c0c8cc

/* Semantic */
--error:   #9f403d
--success: #22c55e
--warning: #fbbf24

/* Dark / inverse */
--inverse-surface: #0c0f10
```

**Rule**: Never use a raw hex colour in a component if a token covers it. Map every value to the list above.

---

## 3. Typography

### Fonts

| Font | Role | Import weights |
|---|---|---|
| **Manrope** | Headlines, labels, badges, nav, numbers | 300–900 |
| **DM Sans** | Body text, inputs, descriptions | 300–700, italic |

```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
```

Always set `-webkit-font-smoothing: antialiased` on `<body>`.

### Scale

| Role | Font | Size | Weight | Other |
|---|---|---|---|---|
| Page title | Manrope | 42px | 900 | `letter-spacing: -.03em` |
| Hero headline | Manrope | clamp(38px,5vw,62px) | 900 | `letter-spacing: -.04em`, `line-height: 1.05` |
| Section headline | Manrope | clamp(28px,4vw,42px) | 900 | `letter-spacing: -.03em` |
| Card title | Manrope | 16–19px | 800 | `letter-spacing: -.02em` |
| Stat number (large) | Manrope | 20–26px | 900 | `line-height: 1` |
| Score input number | Manrope | 26px | 900 | `letter-spacing: -.03em`, `color: #005bc0` |
| Nav link | Manrope | 13.5px | 600 | — |
| Label / overline | Manrope | 8.5–10px | 900 | `letter-spacing: .12–.18em`, `text-transform: uppercase` |
| Body text | DM Sans | 14–17px | 400 | `line-height: 1.6–1.65` |
| Input text | DM Sans | 14px | 400 | — |
| Placeholder | DM Sans | 13px | 400 | italic, `color: #c0c8cc` |
| Badge | Manrope | 10–11px | 700–800 | `letter-spacing: .04–.1em` |

---

## 4. Background texture

Every page gets the dot-grid as a fixed full-screen overlay (pointer-events: none, z-index: 0):

```css
/* Light theme (app + landing) */
body::before {
  content: ''; position: fixed; inset: 0;
  pointer-events: none; z-index: 0;
  background-image: radial-gradient(rgba(43,52,55,0.04) 1px, transparent 1px);
  background-size: 28px 28px;
}

/* Dark theme (admin) */
body::before {
  background-image: radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 28px 28px;
}
```

All page content must sit at `position: relative; z-index: 1` or higher.

---

## 5. Tailwind config (`tailwind.config.js`)

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary:                    '#005bc0',
        'primary-dim':              '#004fa9',
        'primary-container':        '#d8e2ff',
        'on-primary':               '#f7f7ff',
        secondary:                  '#5d5f65',
        'secondary-container':      '#e2e2e9',
        surface:                    '#f8f9fa',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':    '#f1f4f6',
        'surface-container':        '#eaeff1',
        'surface-container-high':   '#e3e9ec',
        'surface-container-highest':'#dbe4e7',
        'on-surface':               '#2b3437',
        'on-surface-variant':       '#586064',
        outline:                    '#737c7f',
        'outline-variant':          '#abb3b7',
        'inverse-surface':          '#0c0f10',
        error:                      '#9f403d',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body:     ['DM Sans', 'sans-serif'],
      },
    }
  }
}
```

---

## 6. Shadows & elevation

```css
/* Resting card */
box-shadow: 0 2px 12px rgba(43,52,55,0.05);

/* Card on hover */
box-shadow: 0 8px 28px rgba(43,52,55,0.10);

/* Active nav link (light sidebar) */
box-shadow: 0 2px 12px rgba(43,52,55,0.09);

/* Command bar / floating panel */
box-shadow: 0 2px 16px rgba(43,52,55,0.07);

/* Modal / bottom sheet */
box-shadow: 0 -8px 48px rgba(43,52,55,0.14);

/* Primary button glow */
box-shadow: 0 4px 14px rgba(0,91,192,0.28);
box-shadow: 0 6px 20px rgba(0,91,192,0.38);  /* hover */

/* Logo mark */
box-shadow: 0 4px 12px rgba(0,91,192,0.28);

/* Landing hero CTA */
box-shadow: 0 8px 28px rgba(0,91,192,0.28);

/* Toast */
box-shadow: 0 8px 28px rgba(0,0,0,0.22);
```

---

## 7. Border radius

```css
/* Pill (sort pills, badges, CTAs) */  border-radius: 999px;
/* Modal / large card (landing) */     border-radius: 24–28px;
/* Card (app) */                       border-radius: 16px;
/* Command bar / panel */              border-radius: 14px;
/* Nav link */                         border-radius: 12px;
/* Logo mark / feature icon */         border-radius: 10px;
/* Button (app) */                     border-radius: 10–12px;
/* Autocomplete menu */                border-radius: 8px;
/* Badge (admin role) */               border-radius: 4px;
/* Avatar */                           border-radius: 50%;
/* Input */                            border-radius: 0  (underline only)
```

---

## 8. Components

### Logo mark

```
36×36px rounded square (border-radius: 10px)
background: #005bc0
box-shadow: 0 4px 12px rgba(0,91,192,0.28)
dice-6 icon: 18×18px, stroke-width: 2.2, color: white
```

Wrapped in `<a href="/">` — always a link back to landing.

Brand name: Manrope 900 14.5px `#2b3437` (light) / `rgba(255,255,255,0.92)` (dark), `letter-spacing: -.02em`
Sub-label: `dicevault.fun` — Manrope 700 8.5px uppercase `letter-spacing: .1em` `#abb3b7`

---

### Nav link (light sidebar)

```css
display: flex; align-items: center; gap: 11px;
padding: 10px 14px; border-radius: 12px;
font: 600 13.5px Manrope; color: #586064;
transition: all .15s;

:hover  → background: #f1f4f6; color: #2b3437;
.active → background: white; color: #005bc0;
          box-shadow: 0 2px 12px rgba(43,52,55,0.09);
          svg stroke: #005bc0;
```

Icon size: 17×17px, flex-shrink: 0.

---

### Nav link (dark sidebar — admin)

```css
color: rgba(255,255,255,0.45);
:hover  → background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8);
.active → background: rgba(255,255,255,0.1); color: #4a8eff; svg stroke: #4a8eff;
```

---

### Mobile bottom nav button

```css
display: flex; flex-direction: column; align-items: center; gap: 3px;
padding: 6px 14px; border-radius: 10px;
font: 800 9px/1 Manrope; letter-spacing: .08em; text-transform: uppercase;
color: #737c7f;
.active → color: #005bc0; svg stroke: #005bc0;
```

---

### Card (light)

```css
background: white; border-radius: 16px;
padding: 16–24px; 
box-shadow: 0 2px 12px rgba(43,52,55,0.05);
transition: transform .18–.2s ease, box-shadow .18–.2s ease;
:hover → transform: translateY(-2–3px); box-shadow: 0 8px 28px rgba(43,52,55,0.10);
```

---

### Card (dark — admin)

```css
background: #161f28; border-radius: 16px;
border: 1px solid rgba(255,255,255,0.07);
```

---

### Buttons

**Primary (light bg)**
```css
background: #005bc0; color: #f7f7ff;
border-radius: 10–14px; padding: 9–14px 18–28px;
font: 700–800 13–15px Manrope;
box-shadow: 0 4px 14px rgba(0,91,192,0.28);
:hover → background: #004fa9; box-shadow: 0 6px 20px rgba(0,91,192,0.38);
```

**Primary pill (nav CTA)**
```css
border-radius: 999px;
box-shadow: 0 4px 14px rgba(0,91,192,0.24);
```

**Secondary / ghost (light)**
```css
background: #f1f4f6; color: #2b3437;
border-radius: 12px;
:hover → background: #dbe4e7;
```

**Danger**
```css
background: rgba(159,64,61,0.08); color: #9f403d;
:hover → background: rgba(159,64,61,0.15);
```

**Icon button (admin)**
```css
width: 30px; height: 30px; border-radius: 8px;
background: transparent; color: rgba(255,255,255,0.35);
:hover → background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);
```

---

### Input (underline style — `.inp`)

```css
width: 100%; height: 44px; box-sizing: border-box;
border: none; border-bottom: 1.5px solid #d1dce0;
border-radius: 0; padding: 0 2px 10px;
font: 400 14px DM Sans; color: #2b3437;
background: transparent; outline: none;
-webkit-appearance: none;
transition: border-bottom-color .22s;

:focus     → border-bottom-color: #005bc0;
::placeholder → color: #c0c8cc; font-style: italic; font-size: 13px;
```

**Score input variant**
```css
font: 900 26px Manrope; color: #005bc0;
text-align: center; letter-spacing: -.03em;
border-bottom-width: 2px; padding: 0 2px 6px;
::placeholder → font-weight: 400; font-size: 18px; font-style: normal; color: #d1dce0;
```

Suppress all browser-native chrome on inputs:
```css
input::-webkit-calendar-picker-indicator,
input::-webkit-list-button,
input::-webkit-inner-spin-button { display: none !important; }
input[type=number] { -moz-appearance: textfield; }
```

---

### Avatar (initials)

Deterministic color from player name hash. Initials = first char of first word + first char of last word (or first two chars if single word).

```css
width: 32–36px; height: 32–36px; border-radius: 50%;
font: 900 11–13px Manrope; color: white; letter-spacing: .02em;
display: flex; align-items: center; justify-content: center;
flex-shrink: 0;
```

User avatar in sidebar footer uses `#005bc0` bg. Player avatars use deterministic colours.

---

### Badge

```css
display: inline-flex; align-items: center;
padding: 3px 10px; border-radius: 99px;
font: 700 11px Manrope; letter-spacing: .04em;
```

Colour variants (dark theme):
- Grandmaster: `background: rgba(0,91,192,0.2); color: #4a8eff; border: 1px solid rgba(0,91,192,0.3)`
- Strategist:  `background: rgba(95,92,120,0.25); color: #a89fd4; border: 1px solid rgba(95,92,120,0.35)`
- Casual:      `background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1)`

---

### Sort / filter pills

```css
padding: 7px 15px; border-radius: 999px;
font: 700 10.5px Manrope; letter-spacing: .07em; text-transform: uppercase;
color: #abb3b7; background: transparent;
transition: all .15s;

:hover  → color: #586064; background: #f1f4f6;
.active → color: #005bc0; background: #eaf0fc;
```

---

### Command bar (search + sort combined)

```css
display: flex; align-items: stretch;
background: white; border-radius: 14px;
box-shadow: 0 2px 16px rgba(43,52,55,0.07);
```

Search section: `padding: 0 18px`, flex: 1, `border-right: 1.5px solid #f1f4f6`. Icon turns `#005bc0` on focus-within.

---

### Sort tabs (underline tab group)

```css
.sort-tabs: border-bottom: 1.5px solid #d1dce0;
.sort-tab: font 700 11px Manrope; letter-spacing: .06em; uppercase;
           border-bottom: 2px solid transparent; margin-bottom: -1.5px;
           color: #c0c8cc;
:hover  → color: #737c7f;
.active → color: #005bc0; border-bottom-color: #005bc0;
```

---

### Toast

```css
position: fixed; bottom: 88px (mobile) / 28px (desktop); left: 50%;
transform: translateX(-50%);
background: #0c0f10; color: white;
padding: 11px 20px; border-radius: 999px;
font: 600 13.5px DM Sans;
box-shadow: 0 8px 28px rgba(0,0,0,0.22);
white-space: nowrap;

@keyframes toastIn  { from { opacity:0; translateY(8px) } to { opacity:1; translateY(0) } }
@keyframes toastOut { to   { opacity:0; translateY(8px) } }
```

In React: use **shadcn/ui Sonner**. Style the toaster to match: dark pill, bottom-center on mobile, bottom-left on desktop.

---

### Modal / bottom sheet

```css
/* Backdrop */
background: rgba(0,0,0,0.2); backdrop-filter: blur(3px);
@keyframes bdin { from opacity:0 → opacity:1 }

/* Panel */
background: white; max-width: 440px;
padding: 28px; border-radius: 24px 24px 0 0 (mobile) / 24px (desktop);
box-shadow: 0 -8px 48px rgba(43,52,55,0.14);
@keyframes mslide { from opacity:0; translateY(16px) → opacity:1; translateY(0) }
```

---

### Progress / win-rate bar

```css
height: 2px; border-radius: 99px;
background: #f1f4f6; overflow: hidden;
.fill: background: #005bc0; transition: width .5s ease;
```

Wider admin progress track:
```css
height: 6px; background: rgba(255,255,255,0.08);
```

---

### Player roster card

```css
display: flex; align-items: center; gap: 14px;
background: white; border-radius: 16px; padding: 16px 22px;
position: relative; overflow: hidden;

/* Watermark rank number */
.p-card-rank: position absolute; right 20px; top 50%; translateY(-50%);
              font 900 80px Manrope; color rgba(43,52,55,0.055);
              letter-spacing -.05em; pointer-events none; z-index 0;

/* Stats — always fixed width from right edge */
.p-card-stats: flex-shrink 0; width 246px;
               grid-template-columns: 74px 86px 86px;

/* Stat label */
font: 900 8.5px Manrope; letter-spacing .12em; uppercase; color #c0c8cc;

/* Stat value */
font: 900 20px Manrope; line-height 1; color #2b3437;
```

---

### Autocomplete dropdown

```css
background: #18242e; border-radius: 8px;
box-shadow: 0 14px 40px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18);
max-height: 228px; overflow-y: auto;

.ac-item: padding 10px 16px; font 400 13.5px DM Sans;
          color rgba(255,255,255,0.72);
:hover   → background rgba(255,255,255,0.09); color white;
+ separator: border-top 1px solid rgba(255,255,255,0.05);
```

---

### Glassmorphism (header / mobile header)

```css
background: rgba(248,249,250,0.85);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(43,52,55,0.07);
```

Admin topbar:
```css
background: rgba(12,15,16,0.85);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(255,255,255,0.06);
```

---

### Status indicators (admin)

```css
.status-active:    background #22c55e; box-shadow 0 0 6px rgba(34,197,94,0.6);
.status-suspended: background #ef4444; box-shadow 0 0 6px rgba(239,68,68,0.6);
/* Dot size: 7×7px, border-radius 50% */
```

---

### Scrollbar

```css
::-webkit-scrollbar       { width: 4px; height: 4px; }
::-webkit-scrollbar-thumb { background: #dbe4e7; border-radius: 99px; }   /* light */
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); }          /* dark */
::-webkit-scrollbar-track { background: transparent; }
```

---

## 9. Animation & motion

```css
/* Page transition (route change) */
@keyframes pageIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
duration: .22s ease

/* Card list item entrance (staggered) */
@keyframes cardIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
duration: .2s ease both
Use animation-delay for staggered lists: nth-child(1) 0ms, (2) 40ms, (3) 80ms…

/* Landing fade-up (hero, sections) */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up   → .6s ease both
.fade-up-2 → .6s .15s ease both
.fade-up-3 → .6s .3s ease both

/* Lift hover (game cards, stat cards) */
transition: transform .2s ease, box-shadow .2s ease;
:hover → transform: translateY(-3px);

/* Slide-in panel (add player, etc.) */
transition: max-height .28s cubic-bezier(.4,0,.2,1), opacity .22s ease, margin .28s ease;

/* Progress bar fill */
transition: width .5s ease;

/* Pulse dot (admin live pill) */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: .4; }
}
duration: 2s ease-in-out infinite
```

**Principle**: one orchestrated entrance per page load (staggered reveals). Avoid scattered micro-animations. Hover states and toasts are the main interactive motion.

---

## 10. Layout

### App shell (desktop, ≥1024px)

```
sidebar: fixed left, width 256px (w-64), full height, white bg
main:    ml-64, min-h-screen
page padding: 36px 28px 40px
```

### App shell (mobile, <1024px)

```
mobile header: fixed top, height 56px (h-14), glass
bottom nav:    fixed bottom, height ~56px, glass, border-top
main:          pt-14 pb-24
```

### Admin shell

```
sidebar: fixed left, width 240px, #131c24 bg
topbar:  sticky top, height 60px, glass dark
content: ml-240px, padding 32px 28px 80px, max-width 1200px
```

### Page header pattern (app)

```
overline: 9.5px Manrope 900 uppercase letter-spacing .18em color #abb3b7
title:    42px Manrope 900 letter-spacing -.03em color #2b3437
margin-bottom: 36px
```

### Section overline pattern (landing)

```
9.5px Manrope 900 uppercase letter-spacing .18em color #abb3b7
margin-bottom: 12px
```

---

## 11. Icon system

**Library**: Lucide (React: `lucide-react`)

Standard sizes:
- Sidebar nav icons: 17×17px
- Button icons: 14–16px
- Feature icons (large containers): 22px
- Logo dice: 18×18px, stroke-width 2.2
- Small inline icons: 13–15px

Always use `flex-shrink: 0` on icons inside flex containers.

---

## 12. Sidebar footer (user profile)

```
Container: display flex; align-items center; gap 10px;
           padding 12px; border-radius 14px; background #f1f4f6
Avatar:    32×32px circle, #005bc0 bg, initials
Name:      700 12.5px DM Sans, color #2b3437, truncated
Role:      700 8.5px Manrope, uppercase, letter-spacing .1em, color #abb3b7
Chevron:   chevron-right 13×13px, color #abb3b7
```

---

## 13. Credit chip

Display current credit balance prominently in the sidebar below the nav. Use the `dice-6` or `coins` icon. Format: `{n} credits`. Color `#005bc0`. Manrope 700–900. Show low-credit warning state when balance < threshold (amber/orange tint).

---

## 14. Anti-patterns — never do these

- ❌ Hardcode any colour not in the token list above
- ❌ Use Inter, Roboto, Arial, or system-ui fonts
- ❌ Use `border-radius: 4–6px` on cards (too sharp — minimum 10px)
- ❌ Use purple gradients or generic AI aesthetics
- ❌ Use native `<select>`, `<datalist>`, or date picker chrome — replace with custom components
- ❌ Use `input[type=number]` spinner arrows — suppress them
- ❌ Put toast/error messages inside form fields — always use Sonner toasts
- ❌ Use `box-shadow` on dark-theme cards — use `border: 1px solid rgba(255,255,255,0.07)` instead
- ❌ Mix light and dark theme tokens in the same component
- ❌ Hardcode any user-facing string — always use `next-intl` translation keys
