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
