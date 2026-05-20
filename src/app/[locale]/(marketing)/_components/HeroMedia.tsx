import Image from 'next/image'
import type { HeroMediaDescriptor } from '@/lib/heroMedia'

const ALT = 'Friends rolling dice at game night'

/**
 * Renders the landing-page hero visual: an admin-uploaded image or auto-playing
 * looping video, or the bundled fallback photo when nothing is configured.
 * Drops into the existing framed/glow box in the marketing page.
 */
export function HeroMedia({ media }: { media: HeroMediaDescriptor | null }) {
  if (!media) {
    return (
      <Image
        src="/hero-game-night.jpg"
        alt={ALT}
        width={420}
        height={300}
        className="block w-full h-auto"
        style={{ objectFit: 'cover', display: 'block' }}
        priority
      />
    )
  }

  const src = `/api/landing/hero-media?v=${encodeURIComponent(media.uploadedAt)}`
  const mediaStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    aspectRatio: '420 / 300',
    objectFit: 'cover',
  }

  if (media.kind === 'video') {
    return <video src={src} autoPlay muted loop playsInline style={mediaStyle} />
  }

  // eslint-disable-next-line @next/next/no-img-element -- dynamic upload route, next/image optimisation not wanted here
  return <img src={src} alt={ALT} style={mediaStyle} />
}
