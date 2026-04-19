'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/Avatar'
import { createPlayer, updatePlayer, deletePlayer } from './actions'
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react'

type Player = { id: string; name: string; avatarSeed: string; linkedUserId: string | null }

export default function PlayersClient({ players: initial, vaultKeeperId }: { players: Player[]; vaultKeeperId: string }) {
  const t = useTranslations('app.players')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const [players, setPlayers] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editName, setEditName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
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
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      )}

      <ul className="space-y-2">
        {players.map(player => {
          const isVaultKeeper = player.linkedUserId === vaultKeeperId
          return (
          <li key={player.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: '#fffdf9', border: `1px solid ${isVaultKeeper ? 'rgba(245,166,35,0.35)' : '#e8e1d8'}` }}>
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
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="font-headline font-semibold text-sm truncate" style={{ color: '#1c1810' }}>{player.name}</span>
                  {isVaultKeeper && (
                    <span className="flex-shrink-0 font-headline font-bold text-[9px] uppercase tracking-[.08em] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>{t('you')}</span>
                  )}
                </div>
                <button onClick={() => { setEditId(player.id); setEditName(player.name) }} className="p-1.5 rounded-lg hover:bg-amber-50" style={{ color: '#9a8878' }}><Pencil size={14} /></button>
                {!isVaultKeeper && (
                  <button onClick={() => setDeleteId(player.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: '#9a8878' }}><Trash2 size={14} /></button>
                )}
              </>
            )}
          </li>
        )})
      </ul>

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
