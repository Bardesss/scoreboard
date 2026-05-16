'use client'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Share2 } from 'lucide-react'
import { QRCodeCanvas } from './QRCode'
import { updateUsername } from './actions'

export function ProfileClient({
  email,
  username,
  connectUrl,
  connections,
}: {
  email: string
  username: string | null
  connectUrl: string
  connections: { email: string; username: string | null }[]
}) {
  const t = useTranslations('app.profile')
  const [state, formAction, pending] = useActionState(
    async (_: unknown, formData: FormData) => updateUsername(formData),
    null
  )
  const displayName = username ?? email

  async function handleShare() {
    const shareData = {
      title: t('shareTitle'),
      text: `${t('shareText')} ${connectUrl}`,
      url: connectUrl,
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        // User cancelled the share sheet — silently fall through to clipboard
        if ((err as Error).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(connectUrl)
      toast.success(t('linkCopied'))
    } catch {
      // Fallback for browsers without clipboard API — open WhatsApp share URL
      window.open(`https://wa.me/?text=${encodeURIComponent(`${t('shareText')} ${connectUrl}`)}`, '_blank')
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-2 space-y-8">
      <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>{t('title')}</h1>

      <section className="flex flex-col items-center gap-4 py-6 rounded-3xl" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <QRCodeCanvas value={connectUrl} />
        <p className="font-headline font-bold text-sm" style={{ color: '#1c1810' }}>{displayName}</p>
        <p className="font-body text-xs text-center max-w-xs" style={{ color: '#9a8878' }}>{t('qrHint')}</p>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-headline font-bold text-sm transition-transform active:scale-95"
          style={{ background: '#f5a623', color: '#1c1408', boxShadow: '0 4px 14px rgba(245,166,35,0.28)' }}
        >
          <Share2 size={15} /> {t('share')}
        </button>
      </section>

      <section>
        <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{t('username')}</h2>
        <form action={formAction} className="flex gap-2">
          <input
            name="username"
            defaultValue={username ?? ''}
            placeholder="e.g. jan_de_vries"
            className="flex-1 px-4 py-2.5 rounded-xl font-body text-sm outline-none"
            style={{ background: '#f5f0e8', border: '1px solid #e8e1d8', color: '#1c1810' }}
          />
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2.5 rounded-xl font-headline font-bold text-sm"
            style={{ background: '#f5a623', color: '#1c1408' }}
          >
            {pending ? '…' : t('save')}
          </button>
        </form>
        {state && 'error' in state && (
          <p className="mt-2 font-body text-xs" style={{ color: '#dc2626' }}>{String(state.error)}</p>
        )}
        {state && 'success' in state && (
          <p className="mt-2 font-body text-xs" style={{ color: '#16a34a' }}>{t('usernameSaved')}</p>
        )}
        <p className="mt-2 font-body text-xs" style={{ color: '#9a8878' }}>{t('usernameHint')}</p>
      </section>

      {connections.length > 0 && (
        <section>
          <h2 className="font-headline font-bold text-sm uppercase tracking-wide mb-3" style={{ color: '#9a8878' }}>{t('connections')}</h2>
          <ul className="space-y-2">
            {connections.map(c => (
              <li key={c.email} className="px-4 py-3 rounded-2xl font-headline font-semibold text-sm" style={{ background: '#fffdf9', border: '1px solid #e8e1d8', color: '#1c1810' }}>
                {c.username ?? c.email}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
