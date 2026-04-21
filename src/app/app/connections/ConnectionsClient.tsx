'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Check, X, Users, Search } from 'lucide-react'
import { searchUsers, sendConnectionRequest, acceptConnectionRequest, declineConnectionRequest, disconnect } from './actions'

type User = { id: string; email: string | null; username: string | null }
type Request = { id: string; fromEmail: string; fromUsername: string | null }
type SentRequest = { id: string; toEmail: string; toUsername: string | null }

export function ConnectionsClient({
  received,
  sent,
  connections,
}: {
  received: Request[]
  sent: SentRequest[]
  connections: User[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [receivedList, setReceivedList] = useState(received)
  const [connectionsList, setConnectionsList] = useState(connections)

  async function handleSearch() {
    const res = await searchUsers(query)
    setResults(res)
  }

  async function handleSend(userId: string) {
    const res = await sendConnectionRequest(userId)
    if ('error' in res) { toast.error('Failed to send request'); return }
    toast.success('Connection request sent')
    setResults(r => r.filter(u => u.id !== userId))
  }

  async function handleAccept(requestId: string) {
    const res = await acceptConnectionRequest(requestId)
    if ('error' in res) { toast.error('Failed'); return }
    toast.success('Connection accepted')
    setReceivedList(l => l.filter(r => r.id !== requestId))
  }

  async function handleDecline(requestId: string) {
    const res = await declineConnectionRequest(requestId)
    if ('error' in res) { toast.error('Failed'); return }
    toast.success('Request declined')
    setReceivedList(l => l.filter(r => r.id !== requestId))
  }

  async function handleDisconnect(userId: string) {
    const res = await disconnect(userId)
    if ('error' in res) { toast.error('Failed'); return }
    toast.success('Disconnected')
    setConnectionsList(l => l.filter(c => c.id !== userId))
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-2 space-y-8">
      <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>Connections</h1>

      <section>
        <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>Find vault keepers</h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by username or email…"
            className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm outline-none"
            style={{ background: '#f5f0e8', border: '1px solid #e8e1d8', color: '#1c1810' }}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm flex items-center gap-2"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            <Search size={15} /> Search
          </button>
        </div>
        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map(u => (
              <li key={u.id} className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <div>
                  <p className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{u.username ?? u.email}</p>
                  {u.username && u.email && <p className="font-body text-xs" style={{ color: '#9a8878' }}>{u.email}</p>}
                </div>
                <button
                  onClick={() => handleSend(u.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-headline font-bold text-xs"
                  style={{ background: '#f5a623', color: '#1c1408' }}
                >
                  <UserPlus size={13} /> Connect
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {receivedList.length > 0 && (
        <section>
          <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>
            Incoming requests ({receivedList.length})
          </h2>
          <ul className="space-y-2">
            {receivedList.map(r => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <div>
                  <p className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{r.fromUsername ?? r.fromEmail}</p>
                  {r.fromUsername && <p className="font-body text-xs" style={{ color: '#9a8878' }}>{r.fromEmail}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDecline(r.id)} className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
                    <X size={14} />
                  </button>
                  <button onClick={() => handleAccept(r.id)} className="p-1.5 rounded-lg" style={{ background: '#dcfce7', color: '#16a34a' }}>
                    <Check size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sent.length > 0 && (
        <section>
          <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>Pending sent</h2>
          <ul className="space-y-2">
            {sent.map(s => (
              <li key={s.id} className="px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <p className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{s.toUsername ?? s.toEmail}</p>
                <p className="font-body text-xs" style={{ color: '#c4b79a' }}>Awaiting response…</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>
          <span className="flex items-center gap-2"><Users size={14} /> Connected vault keepers</span>
        </h2>
        {connectionsList.length === 0 ? (
          <p className="font-body text-sm py-6 text-center" style={{ color: '#9a8878' }}>No connections yet. Search above to connect with other vault keepers.</p>
        ) : (
          <ul className="space-y-2">
            {connectionsList.map(c => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <div>
                  <p className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{c.username ?? c.email}</p>
                  {c.username && c.email && <p className="font-body text-xs" style={{ color: '#9a8878' }}>{c.email}</p>}
                </div>
                <button
                  onClick={() => handleDisconnect(c.id)}
                  className="font-body text-xs px-3 py-1.5 rounded-xl"
                  style={{ background: '#f5f0e8', color: '#9a8878' }}
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
