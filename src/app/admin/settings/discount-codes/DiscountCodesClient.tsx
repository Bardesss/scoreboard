'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Trash2, Plus, X } from 'lucide-react'
import { createDiscountCode, toggleDiscountCode, deleteDiscountCode } from './actions'
import type { DiscountCode } from '@prisma/client'

interface Props {
  codes: DiscountCode[]
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
}

const EMPTY_FORM = {
  code: '',
  type: 'FIXED' as 'FIXED' | 'PERCENT',
  value: '',
  usageLimit: '',
  expiresAt: '',
}

export default function DiscountCodesClient({ codes: initialCodes }: Props) {
  const [codes, setCodes] = useState<DiscountCode[]>(initialCodes)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createDiscountCode({
        code: form.code,
        type: form.type,
        value: Number(form.value),
        usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : null,
        expiresAt: form.expiresAt !== '' ? form.expiresAt : null,
      })
      if (result.success) {
        toast.success('Kortingscode aangemaakt')
        setForm(EMPTY_FORM)
        setShowForm(false)
        // Refresh by reloading page data via router — let revalidatePath handle it
        window.location.reload()
      } else {
        toast.error(result.error ?? 'Aanmaken mislukt')
      }
    })
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      const result = await toggleDiscountCode(id)
      if (result.success) {
        setCodes((prev) =>
          prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
        )
        toast.success('Status bijgewerkt')
      } else {
        toast.error('Bijwerken mislukt')
      }
    })
  }

  function handleDelete(id: string, usedCount: number) {
    if (usedCount > 0) return
    startTransition(async () => {
      const result = await deleteDiscountCode(id)
      if (result.success) {
        setCodes((prev) => prev.filter((c) => c.id !== id))
        toast.success('Kortingscode verwijderd')
      } else if (result.error === 'inUse') {
        toast.error('Kan niet verwijderen: code is al gebruikt')
      } else {
        toast.error('Verwijderen mislukt')
      }
    })
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
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
            Kortingscodes
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            Beheer kortingscodes voor gebruikers
          </p>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#005bc0',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Annuleren' : 'Nieuwe code'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div
          style={{
            background: '#161f28',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.87)',
              marginBottom: 18,
            }}
          >
            Nieuwe kortingscode
          </div>
          <form onSubmit={handleCreate}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Code
                </label>
                <input
                  required
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="ZOMER25"
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, type: e.target.value as 'FIXED' | 'PERCENT' }))
                  }
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                >
                  <option value="FIXED">FIXED (credits)</option>
                  <option value="PERCENT">PERCENT (%)</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Waarde
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={form.type === 'PERCENT' ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                  placeholder={form.type === 'PERCENT' ? '0–100' : 'credits'}
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Gebruikslimiet (leeg = ∞)
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.usageLimit}
                  onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))}
                  placeholder="∞"
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Verloopdatum (leeg = geen)
                </label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                  style={{
                    ...inputStyle,
                    colorScheme: 'dark',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              style={{
                background: '#005bc0',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 18px',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Aanmaken…' : 'Aanmaken'}
            </button>
          </form>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: '#161f28',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Code', 'Type', 'Waarde', 'Gebruikt', 'Verloopdatum', 'Status', 'Acties'].map(
                (col) => (
                  <th
                    key={col}
                    className="font-headline"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.35)',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      padding: '12px 16px',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  Geen kortingscodes aangemaakt.
                </td>
              </tr>
            ) : (
              codes.map((code, i) => {
                const isLast = i === codes.length - 1
                const borderStyle = isLast ? 'none' : '1px solid rgba(255,255,255,0.05)'
                const canDelete = code.usedCount === 0

                return (
                  <tr key={code.id}>
                    <td
                      style={{
                        padding: '13px 16px',
                        borderBottom: borderStyle,
                        fontSize: 13.5,
                        color: 'rgba(255,255,255,0.87)',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {code.code}
                    </td>

                    <td
                      style={{
                        padding: '13px 16px',
                        borderBottom: borderStyle,
                        fontSize: 12.5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background:
                            code.type === 'PERCENT'
                              ? 'rgba(74,142,255,0.15)'
                              : 'rgba(255,255,255,0.07)',
                          color:
                            code.type === 'PERCENT' ? '#4a8eff' : 'rgba(255,255,255,0.6)',
                          border:
                            code.type === 'PERCENT'
                              ? '1px solid rgba(74,142,255,0.3)'
                              : '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        {code.type}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: '13px 16px',
                        borderBottom: borderStyle,
                        fontSize: 13.5,
                        color: 'rgba(255,255,255,0.7)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600 }}>
                        {code.value}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.35)',
                          marginLeft: 4,
                        }}
                      >
                        {code.type === 'PERCENT' ? '%' : 'cr'}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: '13px 16px',
                        borderBottom: borderStyle,
                        fontSize: 13.5,
                        color: 'rgba(255,255,255,0.55)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {code.usedCount}
                      <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>/</span>
                      {code.usageLimit !== null ? code.usageLimit : '∞'}
                    </td>

                    <td
                      style={{
                        padding: '13px 16px',
                        borderBottom: borderStyle,
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.45)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {code.expiresAt
                        ? new Date(code.expiresAt).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>

                    <td
                      style={{
                        padding: '13px 16px',
                        borderBottom: borderStyle,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: code.active
                            ? 'rgba(34,197,94,0.12)'
                            : 'rgba(255,255,255,0.06)',
                          color: code.active ? '#4ade80' : 'rgba(255,255,255,0.4)',
                          border: code.active
                            ? '1px solid rgba(34,197,94,0.25)'
                            : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {code.active ? 'Actief' : 'Inactief'}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: '13px 16px',
                        borderBottom: borderStyle,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Toggle active */}
                        <button
                          onClick={() => handleToggle(code.id)}
                          disabled={isPending}
                          title={code.active ? 'Deactiveren' : 'Activeren'}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8,
                            padding: '5px 8px',
                            cursor: isPending ? 'not-allowed' : 'pointer',
                            color: code.active ? '#4a8eff' : 'rgba(255,255,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {code.active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>

                        {/* Delete */}
                        <div title={!canDelete ? 'Kan niet verwijderen: code is al gebruikt' : ''}>
                          <button
                            onClick={() => handleDelete(code.id, code.usedCount)}
                            disabled={isPending || !canDelete}
                            title={!canDelete ? 'Kan niet verwijderen: code is al gebruikt' : 'Verwijderen'}
                            style={{
                              background: canDelete
                                ? 'rgba(159,64,61,0.15)'
                                : 'rgba(255,255,255,0.04)',
                              border: canDelete
                                ? '1px solid rgba(159,64,61,0.3)'
                                : '1px solid rgba(255,255,255,0.06)',
                              borderRadius: 8,
                              padding: '5px 8px',
                              cursor:
                                isPending || !canDelete ? 'not-allowed' : 'pointer',
                              color: canDelete ? '#e57373' : 'rgba(255,255,255,0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              opacity: !canDelete ? 0.5 : 1,
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
