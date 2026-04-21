'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Trophy, Pencil, Trash2, X, Check } from 'lucide-react'
import { VaultRibbon } from '@/components/shared/VaultRibbon'
import { updateLeague, deleteLeague } from './actions'

type OwnLeague = {
  id: string
  name: string
  description: string | null
  gameTemplate: { name: string; color: string; icon: string }
  _count: { members: number; playedGames: number }
}

type BorrowedLeague = {
  id: string
  name: string
  gameTemplate: { name: string; color: string; icon: string }
  owner: { username: string | null; email: string | null }
  _count: { members: number; playedGames: number }
}

export default function LeaguesClient({
  ownLeagues: initial,
  borrowedLeagues,
}: {
  ownLeagues: OwnLeague[]
  borrowedLeagues: BorrowedLeague[]
}) {
  const t = useTranslations('app.leagues')
  const tErrors = useTranslations('app.errors')
  const tToasts = useTranslations('app.toasts')

  const [ownLeagues, setOwnLeagues] = useState(initial)
  const [editTarget, setEditTarget] = useState<OwnLeague | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  function openEdit(league: OwnLeague) {
    setEditTarget(league)
    setEditName(league.name)
    setEditDescription(league.description ?? '')
  }

  async function handleSave() {
    if (!editTarget) return
    const res = await updateLeague(editTarget.id, { name: editName, description: editDescription })
    if (!res.success) { toast.error(tErrors(res.error as never)); return }
    toast.success(tToasts('leagueSaved'))
    setOwnLeagues(ls => ls.map(x => x.id === editTarget.id ? { ...x, name: editName, description: editDescription || null } : x))
    setEditTarget(null)
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await deleteLeague(deleteId)
      if (!res.success) { toast.error(tErrors(res.error as never)); return }
      toast.success(tToasts('leagueDeleted'))
      setOwnLeagues(ls => ls.filter(x => x.id !== deleteId))
      setDeleteId(null)
    } catch {
      toast.error(tErrors('serverError'))
    }
  }

  const allEmpty = ownLeagues.length === 0 && borrowedLeagues.length === 0

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>
        <Link
          href="/app/leagues/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-headline font-bold text-sm"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          <Plus size={16} /> {t('add')}
        </Link>
      </div>

      {allEmpty ? (
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {ownLeagues.map(league => (
            <li key={league.id} className="rounded-2xl overflow-hidden" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <div className="flex items-center gap-3 p-4">
                <Link href={`/app/leagues/${league.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                    <Trophy size={18} style={{ color: '#f5a623' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{league.name}</div>
                    <div className="text-xs font-body mt-0.5" style={{ color: '#9a8878' }}>
                      {league.gameTemplate.name} · {league._count.members} {t('members')} · {league._count.playedGames} {t('playedGames')}
                    </div>
                  </div>
                </Link>
                <button onClick={() => openEdit(league)} className="p-1.5 rounded-lg hover:bg-amber-50 flex-shrink-0" style={{ color: '#9a8878' }}><Pencil size={14} /></button>
                <button onClick={() => setDeleteId(league.id)} className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0" style={{ color: '#9a8878' }}><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
          {borrowedLeagues.map(league => (
            <li key={league.id} className="relative rounded-2xl overflow-hidden" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <VaultRibbon ownerName={league.owner.username ?? league.owner.email ?? '?'} />
              <Link href={`/app/leagues/${league.id}`} className="block p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
                    <Trophy size={18} style={{ color: '#f5a623' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{league.name}</div>
                    <div className="text-xs font-body mt-0.5" style={{ color: '#9a8878' }}>
                      {league.gameTemplate.name} · {league._count.members} {t('members')} · {league._count.playedGames} {t('playedGames')}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,24,16,0.6)' }}>
          <div className="w-full max-w-md rounded-3xl p-6 space-y-4" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
            <h2 className="font-headline font-black text-lg" style={{ color: '#1c1810' }}>{t('edit')}</h2>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder={t('wizard.namePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border font-body text-sm"
              style={{ borderColor: '#e8e1d8', outline: 'none', background: '#f5f0e8' }}
              onFocus={e => (e.target.style.borderColor = '#f5a623')}
              onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
            />
            <textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder={t('wizard.descriptionPlaceholder')}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
              style={{ borderColor: '#e8e1d8', outline: 'none', background: '#f5f0e8' }}
              onFocus={e => (e.target.style.borderColor = '#f5a623')}
              onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
            />
            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm" style={{ background: '#f5a623', color: '#1c1408' }}>
                <Check size={14} className="inline mr-1" />{t('save')}
              </button>
              <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm" style={{ background: '#f0ebe3', color: '#4a3f2f' }}>
                <X size={14} className="inline mr-1" />{t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,24,16,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-xl" style={{ background: '#fffdf9' }}>
            <p className="font-headline font-bold text-base mb-1" style={{ color: '#1c1810' }}>{t('deleteConfirm')}</p>
            <p className="text-sm mb-6 font-body" style={{ color: '#9a8878' }}>{t('deleteWarning')}</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} className="flex-1 py-2 rounded-xl font-headline font-bold text-sm" style={{ background: '#ef4444', color: '#fff' }}>{t('delete')}</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl font-headline font-bold text-sm" style={{ background: '#f0ebe3', color: '#4a3f2f' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
