import { ImageResponse } from 'next/og'

// Dice Vault favicon — mirrors the sidebar mark: amber square + dice-5 glyph.
// Sized for the standard browser favicon slot (32x32).
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#f5a623',
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="22"
          height="22"
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
