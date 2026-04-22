'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

type Transaction = { delta: number; pool: string; reason: string; date: string }
type UserRow = {
  id: string
  email: string
  monthlyCredits: number
  permanentCredits: number
  isLifetimeFree: boolean
  lastActivity: string | null
}
type FreePeriod = { startsAt: string; endsAt: string }

const card: React.CSSProperties = {
  background: '#161f28',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 24,
}

export default function CreditsClient({
  users,
  transactions,
  freePeriods,
  totalSpentAllTime,
}: {
  users: UserRow[]
  transactions: Transaction[]
  freePeriods: FreePeriod[]
  totalSpentAllTime: number
}) {
  const [tab, setTab] = useState<'overview' | 'users'>('overview')
  const [search, setSearch] = useState('')

  const spentByActionData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {}
    transactions.filter(t => t.delta < 0).forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = {}
      byDate[t.date][t.reason] = (byDate[t.date][t.reason] ?? 0) + Math.abs(t.delta)
    })
    return Object.entries(byDate).slice(-30).map(([date, reasons]) => ({ date, ...reasons }))
  }, [transactions])

  const monthlyLineData = useMemo(() => {
    const byDate: Record<string, { issued: number; spent: number }> = {}
    transactions.forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = { issued: 0, spent: 0 }
      if (t.pool === 'monthly' && t.reason === 'monthly_reset' && t.delta > 0) {
        byDate[t.date].issued += t.delta
      } else if (t.pool === 'monthly' && t.delta < 0) {
        byDate[t.date].spent += Math.abs(t.delta)
      }
    })
    return Object.entries(byDate).slice(-30).map(([date, v]) => ({ date, ...v }))
  }, [transactions])

  const freePeriodDates = useMemo(
    () => freePeriods.map(fp => fp.startsAt.split('T')[0]),
    [freePeriods]
  )

  const filteredUsers = useMemo(
    () => users.filter(u => u.email.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  )

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(245,166,35,0.2)' : 'rgba(255,255,255,0.05)',
    color: active ? '#f5a623' : 'rgba(255,255,255,0.5)',
  })

  const chartTooltipStyle = { background: '#161f28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }
  const axisStyle = { fontSize: 11, fill: 'rgba(255,255,255,0.35)' }
  const gridStyle = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.06)' }
  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '12px 16px',
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)',
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      <h1
        className="font-headline"
        style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4, letterSpacing: '-0.02em' }}
      >
        Credit Analytics
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
        Totaal ooit uitgegeven:{' '}
        <strong style={{ color: 'rgba(255,255,255,0.87)' }}>{totalSpentAllTime} credits</strong>
        {freePeriodDates.length > 0 && (
          <span style={{ marginLeft: 16, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            Gratis periodes: {freePeriodDates.join(', ')}
          </span>
        )}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={tabBtn(tab === 'overview')} onClick={() => setTab('overview')}>Overzicht</button>
        <button style={tabBtn(tab === 'users')} onClick={() => setTab('users')}>Gebruikers ({users.length})</button>
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
              Credits uitgegeven per actie — laatste 30 dagen
            </p>
            {spentByActionData.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>Nog geen transacties.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={spentByActionData}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
                  <Bar dataKey="played_game" name="Played game" fill="#f5a623" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="game_template" name="Game template" fill="#4a8eff" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="league" name="League" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="add_player" name="Add player" fill="#34d399" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={card}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
              Maandelijkse credits — uitgegeven vs. verbruikt (30 dagen)
            </p>
            {monthlyLineData.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>Nog geen maandelijkse resets.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyLineData}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
                  <Line type="monotone" dataKey="issued" name="Uitgegeven (reset)" stroke="#4ade80" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="spent" name="Verbruikt" stroke="#f87171" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op e-mail…"
            style={{
              maxWidth: 400, padding: '9px 14px', marginBottom: 16,
              background: '#161f28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              color: 'rgba(255,255,255,0.87)', fontSize: 13.5, outline: 'none', display: 'block',
            }}
          />
          <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['E-mail', 'Maandelijks', 'Permanent', 'Totaal', 'Flags'].map((h) => (
                    <th key={h} className="font-headline" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: 'rgba(255,255,255,0.87)', borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{u.email}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: u.monthlyCredits < 0 ? '#f87171' : 'rgba(255,255,255,0.7)', fontWeight: 600, borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      {u.monthlyCredits}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: 'rgba(255,255,255,0.7)', borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{u.permanentCredits}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: 'rgba(255,255,255,0.87)', fontWeight: 600, borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{u.monthlyCredits + u.permanentCredits}</td>
                    <td style={{ padding: '14px 16px', borderBottom: i < filteredUsers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {u.isLifetimeFree && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Lifetime</span>
                        )}
                        {u.monthlyCredits < 0 && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>Negatief</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
                      Geen gebruikers gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
