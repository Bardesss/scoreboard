'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/Avatar'
import { createPlayer, updatePlayer, deletePlayer, linkPlayer } from './actions'
import { searchUsers, sendConnectionRequest, acceptConnectionRequest, declineConnectionRequest, disconnect } from '../connections/actions'
import { Pencil, Trash2, Plus, X, Check, UserPlus, Search, Link2, Unlink2 } from 'lucide-react'

type Player = { id: string; name: string; avatarSeed: string; linkedUserId: string | null }
type VaultKeeper = { id: string; email: string | null; username: string | null }
type Request = { id: string; fromEmail: string; fromUsername: string | null }
type SentRequest = { id: string; toEmail: string; toUsername: string | null }

export default function PlayersClient({
  players: initial,
  vaultKeeperId,
  received: initialReceived,
  sent,
  connections: initialConnections,
}: {
  players: Player[]
  vaultKeeperId: string
  received: Request[]
  sent: SentRequest[]
  connections: VaultKeeper[]
}) {
  const t = useTranslations('app.players')
  const tc = useTranslations('app.connections')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')

  // players state
  const [players, setPlayers] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [linkingPlayerId, setLinkingPlayerId] = useState<string | null>(null)

  // connections state
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VaultKeeper[]>([])
  const [receivedList, setReceivedList] = useState(initialReceived)
  const [connectionsList, setConnectionsList] = useState(initialConnections)

  // ── players handlers ──────────────────────────────────────────────────────
  async function handleAdd() {
    const fd = new FormData()
    fd.set('name', newName)
    const res = await createPlayer(fd)
    if (!res.success) { toast.error(tErrors(res.error as never)); return }
    toast.success(tToasts('playerSaved'))
    setAdding(false)
    setNewName('')
    window.location.reload()
  }

  async function handleUpdate(id: string) {
    const fd = new FormData()
    fd.set('name', editName)
    const res = await updatePlayer(id, fd)
    if (!res.success) { toast.error(tErrors(res.error as never)); return }
    toast.success(tToasts('playerSaved'))
    setEditId(null)
    window.location.reload()
  }

  async function handleDelete(id: string) {
    const res = await deletePlayer(id)
    if (!res.success) { toast.error(tErrors(res.error as never)); return }
    toast.success(tToasts('playerDeleted'))
    setPlayers(p => p.filter(x => x.id !== id))
    setDeleteId(null)
  }

  async function handleLink(playerId: string, vaultId: string | null) {
    const res = await linkPlayer(playerId, vaultId)
    if (!res.success) { toast.error(tErrors('serverError')); return }
    setPlayers(p => p.map(x => x.id === playerId ? { ...x, linkedUserId: vaultId } : x))
    setLinkingPlayerId(null)
  }

  // ── connections handlers ──────────────────────────────────────────────────
  async function handleSearch() {
    const res = await searchUsers(query)
    setSearchResults(res)
  }

  async function handleSend(userId: string) {
    const res = await sendConnectionRequest(userId)
    if ('error' in res) { toast.error(tc('requestSentFailed')); return }
    toast.success(tc('requestSent'))
    setSearchResults(r => r.filter(u => u.id !== userId))
  }

  async function handleAccept(requestId: string) {
    const res = await acceptConnectionRequest(requestId)
    if ('error' in res) { toast.error(tc('failed')); return }
    toast.success(tc('accepted'))
    setReceivedList(l => l.filter(r => r.id !== requestId))
    window.location.reload()
  }

  async function handleDecline(requestId: string) {
    const res = await declineConnectionRequest(requestId)
    if ('error' in res) { toast.error(tc('failed')); return }
    toast.success(tc('declined'))
    setReceivedList(l => l.filter(r => r.id !== requestId))
  }

  async function handleDisconnect(userId: string) {
    const res = await disconnect(userId)
    if ('error' in res) { toast.error(tc('failed')); return }
    toast.success(tc('disconnected'))
    setConnectionsList(l => l.filter(c => c.id !== userId))
    setPlayers(p => p.map(x => x.linkedUserId === userId ? { ...x, linkedUserId: null } : x))
  }

  function displayName(u: { email: string | null; username: string | null }) {
    return u.username ?? u.email ?? '?'
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">

      {/* ── Players ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>
        <button
          onClick={() => { setAdding(true); setNewName('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} /> {t('add')}
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-4">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder={t('namePlaceholder')}
            className="flex-1 px-3 py-2 rounded-xl border text-sm font-body"
            style={{ borderColor: '#f5a623', outline: 'none', background: '#fffdf9' }}
          />
          <button onClick={handleAdd} className="p-2 rounded-xl" style={{ background: '#f5a623', color: '#1c1408' }}><Check size={16} /></button>
          <button onClick={() => setAdding(false)} className="p-2 rounded-xl" style={{ background: '#f0ebe3', color: '#4a3f2f' }}><X size={16} /></button>
        </div>
      )}

      {players.length === 0 && !adding && (
        <p className="text-center py-12 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      )}

      <ul className="space-y-2 mb-10">
        {players.map(player => {
          const isMe = player.linkedUserId === vaultKeeperId
          const linkedVK = !isMe && player.linkedUserId
            ? connectionsList.find(c => c.id === player.linkedUserId)
            : null

          return (
            <li key={player.id} className="rounded-2xl overflow-hidden" style={{ background: '#fffdf9', border: `1px solid ${isMe ? 'rgba(245,166,35,0.35)' : '#e8e1d8'}` }}>
              <div className="flex items-center gap-3 p-3">
                <Avatar seed={player.avatarSeed} name={player.name} size={40} />
                {editId === player.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(player.id); if (e.key === 'Escape') setEditId(null) }}
                      className="flex-1 px-3 py-1.5 rounded-xl border text-sm font-body"
                      style={{ borderColor: '#f5a623', outline: 'none', background: '#fffdf9' }}
                    />
                    <button onClick={() => handleUpdate(player.id)} className="p-1.5 rounded-lg" style={{ background: '#f5a623', color: '#1c1408' }}><Check size={14} /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg" style={{ background: '#f0ebe3', color: '#4a3f2f' }}><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-headline font-semibold text-sm truncate" style={{ color: '#1c1810' }}>{player.name}</span>
                        {isMe && (
                          <span className="flex-shrink-0 font-headline font-bold text-[9px] uppercase tracking-[.08em] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>{t('you')}</span>
                        )}
                      </div>
                      {/* Link row — always visible for non-me players */}
                      {!isMe && (
                        <button
                          onClick={() => setLinkingPlayerId(linkingPlayerId === player.id ? null : player.id)}
                          className="flex items-center gap-1 mt-0.5"
                        >
                          {linkedVK ? (
                            <>
                              <Link2 size={11} style={{ color: '#f5a623' }} />
                              <span className="font-body text-xs" style={{ color: '#f5a623' }}>{displayName(linkedVK)}</span>
                            </>
                          ) : (
                            <>
                              <Link2 size={11} style={{ color: '#c4b79a' }} />
                              <span className="font-body text-xs" style={{ color: '#c4b79a' }}>{t('linkVaultKeeper')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <button onClick={() => { setEditId(player.id); setEditName(player.name) }} className="p-1.5 rounded-lg hover:bg-amber-50" style={{ color: '#9a8878' }}><Pencil size={14} /></button>
                    {!isMe && (
                      <button onClick={() => setDeleteId(player.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: '#9a8878' }}><Trash2 size={14} /></button>
                    )}
                  </>
                )}
              </div>

              {/* Link picker */}
              {linkingPlayerId === player.id && (
                <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: '#f0ebe3', background: '#faf7f2' }}>
                  <p className="font-body text-xs mb-2" style={{ color: '#9a8878' }}>{t('linkVaultKeeper')}</p>
                  {connectionsList.length === 0 ? (
                    <p className="font-body text-xs" style={{ color: '#c4b79a' }}>{tc('noConnectionsHint')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {connectionsList.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleLink(player.id, c.id)}
                          className="px-3 py-1.5 rounded-xl font-headline font-bold text-xs"
                          style={{
                            background: player.linkedUserId === c.id ? 'rgba(245,166,35,0.15)' : '#fffdf9',
                            color: player.linkedUserId === c.id ? '#f5a623' : '#4a3f2f',
                            border: `1px solid ${player.linkedUserId === c.id ? 'rgba(245,166,35,0.3)' : '#e8e1d8'}`,
                          }}
                        >
                          {displayName(c)}
                        </button>
                      ))}
                      {player.linkedUserId && player.linkedUserId !== vaultKeeperId && (
                        <button
                          onClick={() => handleLink(player.id, null)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-headline font-bold text-xs"
                          style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}
                        >
                          <Unlink2 size={11} />
                          {t('unlink')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* ── Vault Keepers ── */}
      <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-4" style={{ color: '#9a8878' }}>{tc('find')}</h2>

      <div className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={tc('searchPlaceholder')}
          className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm outline-none"
          style={{ background: '#f5f0e8', border: '1px solid #e8e1d8', color: '#1c1810' }}
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm flex items-center gap-2"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Search size={15} /> {tc('search')}
        </button>
      </div>

      {searchResults.length > 0 && (
        <ul className="mb-6 space-y-2">
          {searchResults.map(u => (
            <li key={u.id} className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <p className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{displayName(u)}</p>
              <button
                onClick={() => handleSend(u.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-headline font-bold text-xs"
                style={{ background: '#f5a623', color: '#1c1408' }}
              >
                <UserPlus size={13} /> {tc('connect')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {receivedList.length > 0 && (
        <section className="mb-6">
          <h3 className="font-headline font-bold text-xs uppercase tracking-wide mb-2" style={{ color: '#9a8878' }}>
            {tc('incoming')} ({receivedList.length})
          </h3>
          <ul className="space-y-2">
            {receivedList.map(r => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <p className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{r.fromUsername ?? r.fromEmail}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleDecline(r.id)} className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}><X size={14} /></button>
                  <button onClick={() => handleAccept(r.id)} className="p-1.5 rounded-lg" style={{ background: '#dcfce7', color: '#16a34a' }}><Check size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sent.length > 0 && (
        <section className="mb-6">
          <h3 className="font-headline font-bold text-xs uppercase tracking-wide mb-2" style={{ color: '#9a8878' }}>{tc('pending')}</h3>
          <ul className="space-y-2">
            {sent.map(s => (
              <li key={s.id} className="px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <p className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{s.toUsername ?? s.toEmail}</p>
                <p className="font-body text-xs" style={{ color: '#c4b79a' }}>{tc('awaitingResponse')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-headline font-bold text-xs uppercase tracking-wide mb-2" style={{ color: '#9a8878' }}>{tc('connected')}</h3>
        {connectionsList.length === 0 ? (
          <p className="font-body text-sm py-4 text-center" style={{ color: '#9a8878' }}>{tc('noConnectionsHint')}</p>
        ) : (
          <ul className="space-y-2">
            {connectionsList.map(c => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
                <p className="font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{displayName(c)}</p>
                <button
                  onClick={() => handleDisconnect(c.id)}
                  className="font-body text-xs px-3 py-1.5 rounded-xl"
                  style={{ background: '#f5f0e8', color: '#9a8878' }}
                >
                  {tc('disconnect')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(28,24,16,0.6)' }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="font-headline font-bold text-base mb-1" style={{ color: '#1c1810' }}>{t('deleteConfirm')}</p>
            <p className="text-sm mb-6 font-body" style={{ color: '#9a8878' }}>{t('deleteWarning')}</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2 rounded-xl font-headline font-bold text-sm" style={{ background: '#ef4444', color: '#fff' }}>{t('delete')}</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl font-headline font-bold text-sm" style={{ background: '#f0ebe3', color: '#4a3f2f' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
