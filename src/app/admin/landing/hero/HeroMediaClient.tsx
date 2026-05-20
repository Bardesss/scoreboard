'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { HeroMediaDescriptor } from '@/lib/heroMedia'
import { uploadHeroMedia, removeHeroMedia } from './actions'

const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'Je hebt geen rechten voor deze actie.',
  no_file: 'Kies eerst een bestand.',
  too_large: 'Bestand is te groot (afbeelding max 8 MB, video max 25 MB).',
  invalid_type: 'Niet-ondersteund bestandstype. Gebruik JPG, PNG, WebP, MP4 of WebM.',
  unknown: 'Er ging iets mis. Probeer het opnieuw.',
}

const buttonStyle: React.CSSProperties = {
  background: '#005bc0',
  color: '#fff',
  borderRadius: 10,
  padding: '9px 18px',
  fontSize: 13.5,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
}

export function HeroMediaClient({ media }: { media: HeroMediaDescriptor | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function showError(code: string) {
    setError(ERROR_TEXT[code] ?? ERROR_TEXT.unknown)
  }

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const result = await uploadHeroMedia(fd)
      if (result.ok) {
        form.reset()
        router.refresh()
      } else {
        showError(result.error)
      }
    })
  }

  function onRemove() {
    setError(null)
    startTransition(async () => {
      const result = await removeHeroMedia()
      if (result.ok) router.refresh()
      else showError(result.error)
    })
  }

  const previewSrc = media ? `/api/landing/hero-media?v=${encodeURIComponent(media.uploadedAt)}` : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current state */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
          Huidige hero
        </div>
        <div
          style={{
            width: 280,
            aspectRatio: '420 / 300',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          {media && previewSrc ? (
            media.kind === 'video' ? (
              <video
                src={previewSrc}
                autoPlay
                muted
                loop
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic upload route
              <img
                src={previewSrc}
                alt="Hero preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- bundled fallback asset
            <img
              src="/hero-game-night.jpg"
              alt="Standaard hero"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
          {media
            ? `Aangepaste ${media.kind === 'video' ? 'video' : 'afbeelding'} actief.`
            : 'Standaardafbeelding wordt gebruikt.'}
        </p>
      </div>

      {/* Upload form */}
      <form onSubmit={onUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          required
          disabled={pending}
          style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}
        />
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          JPG, PNG of WebP (max 8 MB), of MP4 / WebM video (max 25 MB). Video&apos;s spelen
          automatisch af zonder geluid en herhalen.
        </p>
        <button type="submit" disabled={pending} style={{ ...buttonStyle, opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Bezig…' : 'Uploaden'}
        </button>
      </form>

      {/* Remove */}
      {media && (
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          style={{
            ...buttonStyle,
            background: 'transparent',
            color: '#ff6b6b',
            border: '1px solid rgba(255,107,107,0.4)',
            alignSelf: 'flex-start',
            opacity: pending ? 0.6 : 1,
          }}
        >
          Verwijderen / terug naar standaard
        </button>
      )}

      {error && (
        <div
          style={{
            fontSize: 13,
            color: '#ff6b6b',
            background: 'rgba(255,107,107,0.1)',
            border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
