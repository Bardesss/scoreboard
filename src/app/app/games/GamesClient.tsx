'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { VaultRibbon } from '@/components/shared/VaultRibbon'
import { updateGameTemplate, deleteGameTemplate } from './actions'
import { COLORS, ICONS } from './new/wizard-types'

type Template = {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  winType: string
  minPlayers: number | null
  maxPlayers: number | null
  scoringNotes: string | null
}

type BorrowedTemplate = {
  id: string
  name: string
  color: string
  icon: string
  winType: string
  ownerName: string
}

export default function GamesClient({
  templates: initial,
  borrowedTemplates,
}: {
  templates: Template[]
  borrowedTemplates: BorrowedTemplate[]
}) {
  const t = useTranslations('app.games')
  const tw = useTranslations('app.games.wizard')
  const tErrors = useTranslations('app.errors')

  const [templates, setTemplates] = useState(initial)
  const [editTarget, setEditTarget] = useState<Template | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // edit form state
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')
  const [minPlayers, setMinPlayers] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('')
  const [scoringNotes, setScoringNotes] = useState('')

  function openEdit(tmpl: Template) {
    setEditTarget(tmpl)
    setName(tmpl.name)
    setColor(tmpl.color)
    setIcon(tmpl.icon)
    setDescription(tmpl.description ?? '')
    setMinPlayers(tmpl.minPlayers?.toString() ?? '')
    setMaxPlayers(tmpl.maxPlayers?.toString() ?? '')
    setScoringNotes(tmpl.scoringNotes ?? '')
  }

  async function handleSave() {
    if (!editTarget) return
    const res = await updateGameTemplate(editTarget.id, {
      name,
      color,
      icon,
      description,
      minPlayers: minPlayers ? parseInt(minPlayers) : null,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
      scoringNotes,
    })
    if (!res.success) { toast.error(tErrors(res.error as never)); return }
    setTemplates(ts => ts.map(x => x.id === editTarget.id
      ? { ...x, name, color, icon, description: description || null, minPlayers: minPlayers ? parseInt(minPlayers) : null, maxPlayers: maxPlayers ? parseInt(maxPlayers) : null, scoringNotes: scoringNotes || null }
      : x
    ))
    setEditTarget(null)
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await deleteGameTemplate(deleteId)
    if (!res.success) { toast.error(tErrors(res.error as never)); return }
    setTemplates(ts => ts.filter(x => x.id !== deleteId))
    setDeleteId(null)
  }

  const allEmpty = templates.length === 0 && borrowedTemplates.length === 0

  return (
    <>
      {allEmpty ? (
        <p className="text-center py-16 font-body" style={{ color: '#9a8878' }}>{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {templates.map(tmpl => (
            <li key={tmpl.id} className="p-4 rounded-2xl flex items-center gap-3" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${tmpl.color}22` }}>
                {tmpl.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{tmpl.name}</div>
                {tmpl.description && <div className="text-xs font-body truncate mt-0.5" style={{ color: '#9a8878' }}>{tmpl.description}</div>}
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tmpl.color }} />
              <button onClick={() => openEdit(tmpl)} className="p-1.5 rounded-lg hover:bg-amber-50" style={{ color: '#9a8878' }}><Pencil size={15} /></button>
              <button onClick={() => setDeleteId(tmpl.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: '#9a8878' }}><Trash2 size={15} /></button>
            </li>
          ))}
          {borrowedTemplates.map(tmpl => (
            <li key={tmpl.id} className="relative p-4 rounded-2xl flex items-center gap-3" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
              <VaultRibbon ownerName={tmpl.ownerName} />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${tmpl.color}22` }}>
                {tmpl.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{tmpl.name}</div>
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tmpl.color }} />
            </li>
          ))}
        </ul>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(28,24,16,0.6)' }}>
          <div className="w-full max-w-md rounded-3xl overflow-y-auto" style={{ background: '#fffdf9', border: '1px solid #e8e1d8', maxHeight: '90vh' }}>
            <div className="p-6 space-y-5">
              <h2 className="font-headline font-black text-lg" style={{ color: '#1c1810' }}>{t('edit')}</h2>

              <div>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={tw('namePlaceholder')}
                  className="w-full px-4 py-3 rounded-xl border font-body text-sm"
                  style={{ borderColor: '#e8e1d8', outline: 'none', background: '#f5f0e8' }}
                  onFocus={e => (e.target.style.borderColor = '#f5a623')}
                  onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                />
              </div>

              <div>
                <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{tw('colorLabel')}</p>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full transition-transform"
                      style={{
                        background: c,
                        transform: color === c ? 'scale(1.2)' : 'scale(1)',
                        boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="font-headline font-bold text-xs mb-2" style={{ color: '#4a3f2f' }}>{tw('iconLabel')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setIcon(ic)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{
                        background: icon === ic ? 'rgba(245,166,35,0.15)' : 'transparent',
                        border: `1.5px solid ${icon === ic ? '#f5a623' : 'transparent'}`,
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={tw('descriptionPlaceholder')}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
                  style={{ borderColor: '#e8e1d8', outline: 'none', background: '#f5f0e8' }}
                  onFocus={e => (e.target.style.borderColor = '#f5a623')}
                  onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  value={minPlayers}
                  onChange={e => setMinPlayers(e.target.value)}
                  placeholder={tw('minPlayersPlaceholder')}
                  className="flex-1 px-4 py-2.5 rounded-xl border font-body text-sm"
                  style={{ borderColor: '#e8e1d8', outline: 'none', background: '#f5f0e8' }}
                  onFocus={e => (e.target.style.borderColor = '#f5a623')}
                  onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                />
                <input
                  type="number"
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(e.target.value)}
                  placeholder={tw('maxPlayersPlaceholder')}
                  className="flex-1 px-4 py-2.5 rounded-xl border font-body text-sm"
                  style={{ borderColor: '#e8e1d8', outline: 'none', background: '#f5f0e8' }}
                  onFocus={e => (e.target.style.borderColor = '#f5a623')}
                  onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                />
              </div>

              <div>
                <textarea
                  value={scoringNotes}
                  onChange={e => setScoringNotes(e.target.value)}
                  placeholder={tw('scoringNotesPlaceholder')}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
                  style={{ borderColor: '#e8e1d8', outline: 'none', background: '#f5f0e8' }}
                  onFocus={e => (e.target.style.borderColor = '#f5a623')}
                  onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm"
                  style={{ background: '#f5a623', color: '#1c1408' }}
                >
                  {t('save')}
                </button>
                <button onClick={() => setEditTarget(null)}
                  className="flex-1 py-2.5 rounded-xl font-headline font-bold text-sm"
                  style={{ background: '#f0ebe3', color: '#4a3f2f' }}
                >
                  {t('cancel')}
                </button>
              </div>
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
              <button onClick={handleDelete}
                className="flex-1 py-2 rounded-xl font-headline font-bold text-sm"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                {t('delete')}
              </button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2 rounded-xl font-headline font-bold text-sm"
                style={{ background: '#f0ebe3', color: '#4a3f2f' }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
