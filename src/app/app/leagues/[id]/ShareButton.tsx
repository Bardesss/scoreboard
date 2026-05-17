'use client'
import { Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export function ShareButton({ token }: { token: string }) {
  const t = useTranslations('app.playedGames')
  function copy() {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
    toast.success(t('shareCopied'))
  }
  return (
    <button onClick={copy} className="p-1.5 rounded-lg transition-colors hover:bg-black/5" title={t('shareLink')} aria-label={t('shareLink')}>
      <Link2 size={14} style={{ color: '#9a8878' }} />
    </button>
  )
}
