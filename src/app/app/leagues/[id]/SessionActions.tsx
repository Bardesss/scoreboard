'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { deletePlayedGame } from './actions'

type Props = {
  playedGameId: string
  leagueId: string
}

export function SessionActions({ playedGameId, leagueId }: Props) {
  const t = useTranslations('app.leagues')
  const tErrors = useTranslations('app.errors')
  const tToasts = useTranslations('app.toasts')
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const result = await deletePlayedGame(playedGameId, leagueId)
    setDeleting(false)
    if (!result.success) {
      toast.error(tErrors(result.error as never))
      setConfirming(false)
      return
    }
    toast.success(tToasts('sessionDeleted'))
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="font-body text-xs flex-1" style={{ color: '#4a3f2f' }}>{t('deleteSessionConfirm')}</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-3 py-1 rounded-lg font-headline font-semibold text-xs"
          style={{ background: '#f0ebe3', color: '#4a3f2f' }}
        >
          {t('deleteSessionCancel')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1 rounded-lg font-headline font-semibold text-xs disabled:opacity-50"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          {deleting ? t('deleting') : t('deleteSessionConfirmBtn')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <Link
        href={`/app/leagues/${leagueId}/log?edit=${playedGameId}`}
        className="p-1.5 rounded-lg"
        style={{ color: '#9a8878' }}
        title={t('edit')}
      >
        <Pencil size={14} />
      </Link>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="p-1.5 rounded-lg"
        style={{ color: '#9a8878' }}
        title={t('deleteSessionConfirmBtn')}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
