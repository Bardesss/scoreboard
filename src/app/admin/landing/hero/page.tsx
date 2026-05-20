import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getHeroMedia } from '@/lib/heroMedia'
import { HeroMediaClient } from './HeroMediaClient'

export default async function AdminLandingHeroPage() {
  const media = await getHeroMedia()

  return (
    <div>
      <Link
        href="/admin/landing"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={15} /> Terug naar Landing instellingen
      </Link>

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
        Hero afbeelding / video
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
        Upload een eigen afbeelding of korte video voor de hero op de landingspagina.
      </p>

      <div
        style={{
          background: '#161f28',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <HeroMediaClient media={media} />
      </div>
    </div>
  )
}
