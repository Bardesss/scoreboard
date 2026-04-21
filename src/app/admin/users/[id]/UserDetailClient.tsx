'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  toggleLifetimeFree,
  toggleRequiresMfa,
  setUserRole,
  adjustCredits,
} from '../actions'

interface CreditTx {
  id: string
  delta: number
  reason: string
  createdAt: string
}

interface UserData {
  id: string
  email: string
  username: string | null
  role: string
  monthlyCredits: number
  permanentCredits: number
  isLifetimeFree: boolean
  requiresMfa: boolean
  totpEnabled: boolean
  emailVerified: string | null
  createdAt: string
}

interface Props {
  user: UserData
  transactions: CreditTx[]
}

function Toggle({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    await onToggle()
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>{label}</span>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: checked ? '#4a8eff' : 'rgba(255,255,255,0.12)',
          position: 'relative',
          transition: 'background 0.2s',
          opacity: loading ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  )
}

export default function UserDetailClient({ user, transactions }: Props) {
  const [creditDelta, setCreditDelta] = useState<string>('')
  const [creditReason, setCreditReason] = useState('')
  const [creditLoading, setCreditLoading] = useState(false)
  const [role, setRole] = useState(user.role)
  const [roleLoading, setRoleLoading] = useState(false)

  async function handleToggleLifetime() {
    const res = await toggleLifetimeFree(user.id)
    if (res.success) {
      toast.success('Lifetime status bijgewerkt')
    } else {
      toast.error('Er ging iets mis')
    }
  }

  async function handleToggleMfa() {
    const res = await toggleRequiresMfa(user.id)
    if (res.success) {
      toast.success('MFA-vereiste bijgewerkt')
    } else {
      toast.error('Er ging iets mis')
    }
  }

  async function handleRoleChange(newRole: 'user' | 'admin') {
    setRoleLoading(true)
    const res = await setUserRole(user.id, newRole)
    if (res.success) {
      setRole(newRole)
      toast.success('Rol bijgewerkt')
    } else {
      toast.error('Er ging iets mis')
    }
    setRoleLoading(false)
  }

  async function handleCreditSubmit(e: React.FormEvent) {
    e.preventDefault()
    const delta = parseInt(creditDelta, 10)
    if (isNaN(delta) || delta === 0) {
      toast.error('Voer een geldig bedrag in (niet 0)')
      return
    }
    if (!creditReason.trim()) {
      toast.error('Voer een reden in')
      return
    }
    setCreditLoading(true)
    const res = await adjustCredits(user.id, delta, creditReason.trim())
    if (res.success) {
      toast.success(`${delta > 0 ? '+' : ''}${delta} credits toegekend`)
      setCreditDelta('')
      setCreditReason('')
    } else if (res.error === 'invalidDelta') {
      toast.error('Delta mag niet 0 zijn')
    } else {
      toast.error('Er ging iets mis')
    }
    setCreditLoading(false)
  }

  const cardStyle: React.CSSProperties = {
    background: '#161f28',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '20px 24px',
    marginBottom: 20,
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 16,
  }

  const inputStyle: React.CSSProperties = {
    background: '#0c0f10',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.87)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  const divider: React.CSSProperties = {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    margin: '0 -24px',
    padding: '0',
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Back link */}
      <Link
        href="/admin/users"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          marginBottom: 24,
        }}
      >
        ← Terug naar gebruikers
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          className="font-headline"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.87)',
            marginBottom: 4,
            letterSpacing: '-0.02em',
          }}
        >
          {user.username ? `@${user.username}` : user.email}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{user.email}</p>
      </div>

      {/* Info card */}
      <div style={cardStyle}>
        <p className="font-headline" style={sectionTitle}>Accountinfo</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 32px' }}>
          {[
            ['ID', user.id],
            ['Aangemaakt', new Date(user.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })],
            ['E-mail geverifieerd', user.emailVerified ? new Date(user.emailVerified).toLocaleDateString('nl-NL') : 'Nee'],
            ['TOTP actief', user.totpEnabled ? 'Ja' : 'Nee'],
            ['Maandelijkse credits', String(user.monthlyCredits)],
            ['Permanente credits', String(user.permanentCredits)],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.75)', wordBreak: 'break-all' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Role */}
      <div style={cardStyle}>
        <p className="font-headline" style={sectionTitle}>Rol</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={role}
            disabled={roleLoading}
            onChange={e => handleRoleChange(e.target.value as 'user' | 'admin')}
            style={{
              ...inputStyle,
              width: 'auto',
              minWidth: 160,
              cursor: roleLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <option value="user">Gebruiker</option>
            <option value="admin">Beheerder</option>
          </select>
          {roleLoading && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Opslaan…</span>
          )}
        </div>
      </div>

      {/* Toggles */}
      <div style={cardStyle}>
        <p className="font-headline" style={sectionTitle}>Vlaggen</p>
        <div>
          <Toggle
            label="Lifetime gratis"
            checked={user.isLifetimeFree}
            onToggle={handleToggleLifetime}
          />
          <div style={divider} />
          <Toggle
            label="MFA verplicht"
            checked={user.requiresMfa}
            onToggle={handleToggleMfa}
          />
        </div>
      </div>

      {/* Credit adjustment */}
      <div style={cardStyle}>
        <p className="font-headline" style={sectionTitle}>Credits aanpassen</p>
        <form onSubmit={handleCreditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 5 }}>
                Bedrag (negatief = aftrekken)
              </label>
              <input
                type="number"
                value={creditDelta}
                onChange={e => setCreditDelta(e.target.value)}
                placeholder="bijv. 50 of -10"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 5 }}>
                Reden
              </label>
              <input
                type="text"
                value={creditReason}
                onChange={e => setCreditReason(e.target.value)}
                placeholder="Waarom deze aanpassing?"
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={creditLoading}
              style={{
                background: '#4a8eff',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 20px',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: creditLoading ? 'not-allowed' : 'pointer',
                opacity: creditLoading ? 0.7 : 1,
              }}
            >
              {creditLoading ? 'Opslaan…' : 'Toepassen'}
            </button>
          </div>
        </form>
      </div>

      {/* Credit history */}
      <div style={cardStyle}>
        <p className="font-headline" style={sectionTitle}>Credittransacties (laatste 10)</p>
        {transactions.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.35)' }}>Geen transacties gevonden.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {transactions.map((tx, i) => (
              <li
                key={tx.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '11px 0',
                  borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: tx.delta > 0 ? '#4ade80' : '#f87171',
                    minWidth: 52,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {tx.delta > 0 ? '+' : ''}{tx.delta}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{tx.reason}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    {new Date(tx.createdAt).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
