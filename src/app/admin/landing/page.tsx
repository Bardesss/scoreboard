import Link from 'next/link'
import { MessageSquareQuote, FileText } from 'lucide-react'

const cardStyle: React.CSSProperties = {
  background: '#161f28',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 24,
}

export default function AdminLandingPage() {
  return (
    <div>
      <h1
        className="font-headline"
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.87)',
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}
      >
        Landing instellingen
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 32 }}>
        Beheer de inhoud van de landingspagina.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Reviews card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'rgba(74,142,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageSquareQuote size={20} style={{ color: '#4a8eff' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4 }}>
                  Reviews
                </div>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                  Bekijk en beheer reviews die op de landingspagina worden getoond.
                </p>
              </div>
            </div>
            <Link
              href="/admin/landing/reviews"
              style={{
                flexShrink: 0,
                background: '#005bc0',
                color: '#fff',
                borderRadius: 10,
                padding: '8px 18px',
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Beheren
            </Link>
          </div>
        </div>

        {/* Content card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={20} style={{ color: 'rgba(255,255,255,0.45)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4 }}>
                Content
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '12px 16px',
                marginTop: 10,
              }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
                  De tekst op de landingspagina is beheerd via i18n bestanden. Bewerk{' '}
                  <code style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 6px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    messages/nl/landing.json
                  </code>{' '}
                  en{' '}
                  <code style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 6px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    messages/en/landing.json
                  </code>{' '}
                  om de tekst aan te passen.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
