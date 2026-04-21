'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPage, updatePage } from './actions'

interface PageData {
  id: string
  slug: string
  isSystem: boolean
  titleNl: string
  titleEn: string
  contentNl: string
  contentEn: string
  published: boolean
  order: number
}

interface PageFormProps {
  mode: 'new' | 'edit'
  page?: PageData
}

export default function PageForm({ mode, page }: PageFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [slug, setSlug] = useState(page?.slug ?? '')
  const [titleNl, setTitleNl] = useState(page?.titleNl ?? '')
  const [titleEn, setTitleEn] = useState(page?.titleEn ?? '')
  const [contentNl, setContentNl] = useState(page?.contentNl ?? '')
  const [contentEn, setContentEn] = useState(page?.contentEn ?? '')
  const [published, setPublished] = useState(page?.published ?? true)
  const [order, setOrder] = useState(page?.order ?? 0)
  const [error, setError] = useState<string | null>(null)

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.8)',
    borderRadius: 10,
    padding: '8px 14px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  const cardStyle = {
    background: '#161f28',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      if (mode === 'new') {
        const result = await createPage({ slug, titleNl, titleEn, contentNl, contentEn, published })
        if (!result.success) {
          if (result.error === 'slugInvalid') {
            setError('Slug mag alleen kleine letters, cijfers en koppeltekens bevatten.')
          } else if (result.error === 'slugTaken') {
            setError('Deze slug is al in gebruik.')
          } else {
            setError(result.error ?? 'Aanmaken mislukt')
          }
          return
        }
        router.push('/admin/pages')
      } else {
        const result = await updatePage(page!.id, {
          titleNl,
          titleEn,
          contentNl,
          contentEn,
          published,
          order,
        })
        if (!result.success) {
          setError(result.error ?? 'Opslaan mislukt')
          return
        }
        router.push('/admin/pages')
      }
    })
  }

  return (
    <div>
      <Link
        href="/admin/pages"
        style={{
          display: 'inline-block',
          marginBottom: 24,
          fontSize: 13.5,
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
        }}
      >
        ← Terug
      </Link>

      <h1
        className="font-headline"
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.87)',
          marginBottom: 24,
          letterSpacing: '-0.02em',
        }}
      >
        {mode === 'new' ? 'Nieuwe pagina' : `Bewerken: ${page?.titleNl}`}
      </h1>

      {error && (
        <div
          style={{
            background: 'rgba(159,64,61,0.2)',
            border: '1px solid rgba(159,64,61,0.4)',
            borderRadius: 10,
            padding: '10px 16px',
            color: '#ff9999',
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {/* Slug */}
      {mode === 'new' && (
        <div style={cardStyle}>
          <label style={labelStyle}>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="bijv. over-ons"
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
            Alleen kleine letters, cijfers en koppeltekens. Wordt de URL: /p/slug
          </p>
        </div>
      )}

      {mode === 'edit' && (
        <div style={cardStyle}>
          <label style={labelStyle}>Slug (niet wijzigbaar)</label>
          <div
            style={{
              ...inputStyle,
              color: 'rgba(255,255,255,0.4)',
              cursor: 'not-allowed',
              fontFamily: 'monospace',
            }}
          >
            {page?.slug}
          </div>
        </div>
      )}

      {/* Titles */}
      <div style={cardStyle}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }}
        >
          <div>
            <label style={labelStyle}>Titel (Nederlands)</label>
            <input
              type="text"
              value={titleNl}
              onChange={(e) => setTitleNl(e.target.value)}
              placeholder="Titel NL"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Titel (Engels)</label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Titel EN"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Content NL */}
      <div style={cardStyle}>
        <label style={labelStyle}>Inhoud (Nederlands, Markdown)</label>
        <textarea
          value={contentNl}
          onChange={(e) => setContentNl(e.target.value)}
          rows={12}
          placeholder="# Kop&#10;&#10;Inhoud in Markdown..."
          style={{
            ...inputStyle,
            resize: 'vertical',
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* Content EN */}
      <div style={cardStyle}>
        <label style={labelStyle}>Inhoud (Engels, Markdown)</label>
        <textarea
          value={contentEn}
          onChange={(e) => setContentEn(e.target.value)}
          rows={12}
          placeholder="# Heading&#10;&#10;Content in Markdown..."
          style={{
            ...inputStyle,
            resize: 'vertical',
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* Published + Order */}
      <div style={{ ...cardStyle, display: 'flex', gap: 32, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#4a8eff' }}
          />
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
            Gepubliceerd
          </span>
        </label>

        {mode === 'edit' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Volgorde</label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleSubmit}
          disabled={pending}
          style={{
            background: '#005bc0',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Bezig...' : mode === 'new' ? 'Aanmaken' : 'Opslaan'}
        </button>
        <Link
          href="/admin/pages"
          style={{
            padding: '10px 20px',
            fontSize: 14,
            color: 'rgba(255,255,255,0.45)',
            textDecoration: 'none',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Annuleren
        </Link>
      </div>
    </div>
  )
}
