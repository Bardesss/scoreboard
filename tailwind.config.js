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
