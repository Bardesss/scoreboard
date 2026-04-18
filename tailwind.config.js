/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Warm Amber Design System ──────────────────────── */
        primary:                     '#f5a623',
        'primary-dim':               '#e09518',
        'primary-container':         '#fff3d4',
        'on-primary':                '#1c1408',
        secondary:                   '#6b5e4a',
        'secondary-container':       '#f0ebe0',
        surface:                     '#f7f3ed',
        'surface-container-lowest':  '#fefcf8',
        'surface-container-low':     '#f2ece3',
        'surface-container':         '#ede5d8',
        'surface-container-high':    '#e5dccb',
        'surface-container-highest': '#dbd0bc',
        'on-surface':                '#1e1a14',
        'on-surface-variant':        '#6b5e4a',
        outline:                     '#9a8c7a',
        'outline-variant':           '#c5b89f',
        'inverse-surface':           '#1c1810',
        error:                       '#9f403d',
        /* shadcn CSS variable mappings */
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card:        { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover:     { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent:      { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body:     ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
