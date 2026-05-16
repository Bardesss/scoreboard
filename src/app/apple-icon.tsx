import { ImageResponse } from 'next/og'

// Apple touch icon — shown on iOS home-screen when the site is saved as a PWA
// shortcut. Same dice-5 glyph as icon.tsx, scaled to Apple's standard 180x180
// with slightly bigger rounding to fit iOS visual style.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#f5a623',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1c1408"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="3" ry="3" />
          <circle cx="8" cy="8" r="1.1" fill="#1c1408" />
          <circle cx="16" cy="8" r="1.1" fill="#1c1408" />
          <circle cx="12" cy="12" r="1.1" fill="#1c1408" />
          <circle cx="8" cy="16" r="1.1" fill="#1c1408" />
          <circle cx="16" cy="16" r="1.1" fill="#1c1408" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
