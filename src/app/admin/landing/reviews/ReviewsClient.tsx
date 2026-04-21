'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Eye, EyeOff, Trash2, Plus, X, Pencil,
  ChevronUp, ChevronDown, MessageSquareQuote,
} from 'lucide-react'
import { createReview, updateReview, deleteReview, reorderReview } from './actions'
import type { Review } from '@prisma/client'

interface Props {
  reviews: Review[]
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.8)',
  borderRadius: 10,
  padding: '8px 14px',
  outline: 'none',
  fontSize: 13.5,
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.45)',
  display: 'block',
  marginBottom: 6,
}

const EMPTY_FORM = { name: '', review: '', favoriteBoardGame: '' }

type EditState = {
  name: string
  review: string
  favoriteBoardGame: string
  visible: boolean
}

export default function ReviewsClient({ reviews: initialReviews }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditState>({ name: '', review: '', favoriteBoardGame: '', visible: true })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openEdit(r: Review) {
    setEditingId(r.id)
    setEditForm({ name: r.name, review: r.review, favoriteBoardGame: r.favoriteBoardGame, visible: r.visible })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createReview(form)
      if (result.success) {
        toast.success('Review aangemaakt')
        setForm(EMPTY_FORM)
        setShowCreateForm(false)
        window.location.reload()
      } else {
        toast.error(result.error ?? 'Aanmaken mislukt')
      }
    })
  }

  function handleUpdate(id: string) {
    startTransition(async () => {
      const result = await updateReview(id, editForm)
      if (result.success) {
        toast.success('Review bijgewerkt')
        setReviews(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, ...editForm }
              : r
          )
        )
        setEditingId(null)
      } else {
        toast.error('Bijwerken mislukt')
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteReview(id)
      if (result.success) {
        toast.success('Review verwijderd')
        setReviews(prev => prev.filter(r => r.id !== id))
        setConfirmDeleteId(null)
      } else {
        toast.error('Verwijderen mislukt')
      }
    })
  }

  function handleReorder(id: string, direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await reorderReview(id, direction)
      if (result.success) {
        window.location.reload()
      } else {
        toast.error('Volgorde wijzigen mislukt')
      }
    })
  }

  function handleToggleVisible(r: Review) {
    startTransition(async () => {
      const result = await updateReview(r.id, {
        name: r.name,
        review: r.review,
        favoriteBoardGame: r.favoriteBoardGame,
        visible: !r.visible,
      })
      if (result.success) {
        toast.success(r.visible ? 'Review verborgen' : 'Review zichtbaar')
        setReviews(prev => prev.map(x => x.id === r.id ? { ...x, visible: !x.visible } : x))
      } else {
        toast.error('Bijwerken mislukt')
      }
    })
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 16,
  }

  const iconBtnStyle = (active?: boolean): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '5px 8px',
    cursor: isPending ? 'not-allowed' : 'pointer',
    color: active ? '#4a8eff' : 'rgba(255,255,255,0.45)',
    display: 'flex',
    alignItems: 'center',
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1
            className="font-headline"
            style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.87)', letterSpacing: '-0.02em', margin: 0 }}
          >
            Reviews
          </h1>
          <span
            style={{
              background: 'rgba(74,142,255,0.12)',
              border: '1px solid rgba(74,142,255,0.25)',
              color: '#4a8eff',
              borderRadius: 20,
              padding: '2px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {reviews.length}
          </span>
        </div>

        <button
          onClick={() => setShowCreateForm(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#005bc0', color: '#fff', border: 'none',
            borderRadius: 10, padding: '8px 16px', fontSize: 13.5,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showCreateForm ? <X size={15} /> : <Plus size={15} />}
          {showCreateForm ? 'Annuleren' : 'Nieuwe review'}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 18 }}>
            Nieuwe review toevoegen
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Naam</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Jan de Vries"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Favoriet bordspel</label>
                <input
                  required
                  type="text"
                  value={form.favoriteBoardGame}
                  onChange={e => setForm(p => ({ ...p, favoriteBoardGame: e.target.value }))}
                  placeholder="Catan"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Review</label>
              <textarea
                required
                rows={3}
                value={form.review}
                onChange={e => setForm(p => ({ ...p, review: e.target.value }))}
                placeholder="Schrijf hier de review..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              style={{
                background: '#005bc0', color: '#fff', border: 'none',
                borderRadius: 10, padding: '8px 18px', fontSize: 13.5,
                fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Aanmaken…' : 'Aanmaken'}
            </button>
          </form>
        </div>
      )}

      {/* Empty state */}
      {reviews.length === 0 && !showCreateForm && (
        <div
          style={{
            background: '#161f28', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: 48, textAlign: 'center',
          }}
        >
          <MessageSquareQuote size={32} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
            Nog geen reviews. Voeg er een toe via &ldquo;Nieuwe review&rdquo;.
          </p>
        </div>
      )}

      {/* Review list */}
      {reviews.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map((r, idx) => (
            <div key={r.id} style={cardStyle}>
              {editingId === r.id ? (
                /* Inline edit form */
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
                    Review bewerken
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>Naam</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Favoriet bordspel</label>
                      <input
                        type="text"
                        value={editForm.favoriteBoardGame}
                        onChange={e => setEditForm(p => ({ ...p, favoriteBoardGame: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Review</label>
                    <textarea
                      rows={3}
                      value={editForm.review}
                      onChange={e => setEditForm(p => ({ ...p, review: e.target.value }))}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                      <input
                        type="checkbox"
                        checked={editForm.visible}
                        onChange={e => setEditForm(p => ({ ...p, visible: e.target.checked }))}
                        style={{ accentColor: '#4a8eff' }}
                      />
                      Zichtbaar op landingspagina
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => handleUpdate(r.id)}
                      disabled={isPending}
                      style={{
                        background: '#005bc0', color: '#fff', border: 'none',
                        borderRadius: 10, padding: '7px 16px', fontSize: 13,
                        fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer',
                        opacity: isPending ? 0.7 : 1,
                      }}
                    >
                      {isPending ? 'Opslaan…' : 'Opslaan'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                        padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              ) : (
                /* Read view */
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.87)' }}>{r.name}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>—</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{r.favoriteBoardGame}</span>
                      {!r.visible && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5,
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          Verborgen
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {r.review}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {/* Order up */}
                    <button
                      onClick={() => handleReorder(r.id, 'up')}
                      disabled={isPending || idx === 0}
                      title="Omhoog"
                      style={{ ...iconBtnStyle(), opacity: idx === 0 ? 0.3 : 1 }}
                    >
                      <ChevronUp size={14} />
                    </button>

                    {/* Order down */}
                    <button
                      onClick={() => handleReorder(r.id, 'down')}
                      disabled={isPending || idx === reviews.length - 1}
                      title="Omlaag"
                      style={{ ...iconBtnStyle(), opacity: idx === reviews.length - 1 ? 0.3 : 1 }}
                    >
                      <ChevronDown size={14} />
                    </button>

                    {/* Toggle visible */}
                    <button
                      onClick={() => handleToggleVisible(r)}
                      disabled={isPending}
                      title={r.visible ? 'Verbergen' : 'Zichtbaar maken'}
                      style={iconBtnStyle(r.visible)}
                    >
                      {r.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEdit(r)}
                      disabled={isPending}
                      title="Bewerken"
                      style={iconBtnStyle()}
                    >
                      <Pencil size={14} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setConfirmDeleteId(r.id)}
                      disabled={isPending}
                      title="Verwijderen"
                      style={{
                        background: 'rgba(159,64,61,0.15)',
                        border: '1px solid rgba(159,64,61,0.3)',
                        borderRadius: 8, padding: '5px 8px',
                        cursor: isPending ? 'not-allowed' : 'pointer',
                        color: '#e57373', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm delete dialog */}
              {confirmDeleteId === r.id && (
                <div style={{
                  marginTop: 12, padding: '12px 16px',
                  background: 'rgba(159,64,61,0.1)', border: '1px solid rgba(159,64,61,0.25)',
                  borderRadius: 10,
                }}>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 10px' }}>
                    Weet je zeker dat je de review van <strong>{r.name}</strong> wilt verwijderen?
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={isPending}
                      style={{
                        background: '#c0392b', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '6px 14px', fontSize: 13,
                        fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Verwijderen
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                        padding: '6px 14px', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
