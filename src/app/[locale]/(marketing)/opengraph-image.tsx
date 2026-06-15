import { ImageResponse } from 'next/og'

// Default social-share card for all marketing pages (landing + /p/[slug]).
// Lives under (marketing) so its route is locale-prefixed (/en/opengraph-image)
// and isn't redirected by the i18n middleware. Next merges this into both
// og:image and twitter:image automatically.
export const alt = 'Dice Vault — Remember who actually won.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(150deg, #161100 0%, #1c1700 60%, #141100 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 132,
              height: 132,
              background: '#f5a623',
              borderRadius: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="88"
              height="88"
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
          <div
            style={{
              fontSize: 92,
              fontWeight: 900,
              color: '#ede8dd',
              letterSpacing: '-0.04em',
            }}
          >
            Dice Vault
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 38,
            color: '#c9b896',
            maxWidth: 880,
            textAlign: 'center',
          }}
        >
          Log every game night, track stats, and settle debates once and for all.
        </div>
      </div>
    ),
    { ...size },
  )
}
