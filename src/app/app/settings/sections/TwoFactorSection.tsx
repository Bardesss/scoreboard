'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  confirmTotpSetup,
  disableTotp,
  initTotpSetup,
  regenerateBackupCodes,
} from '../actions'

type Mode = 'idle' | 'setup' | 'backupReveal' | 'disable' | 'regenerate'

type SetupData = { secret: string; uri: string; qrDataUrl: string }

const cardStyle: React.CSSProperties = {
  background: '#fefcf8',
  border: '1px solid #e8e1d8',
  borderRadius: 24,
  padding: 24,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#f5f0e8',
  border: '1px solid #e8e1d8',
  borderRadius: 12,
  color: '#1e1a14',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'var(--font-body)',
  letterSpacing: 2,
}

const primaryButton: React.CSSProperties = {
  background: '#f5a623',
  color: '#1c1408',
  border: 'none',
  borderRadius: 12,
  padding: '10px 20px',
  fontFamily: 'var(--font-headline)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
}

const secondaryButton: React.CSSProperties = {
  background: 'transparent',
  color: '#9a8878',
  border: '1px solid #e8e1d8',
  borderRadius: 12,
  padding: '10px 18px',
  fontFamily: 'var(--font-headline)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
}

const dangerButton: React.CSSProperties = {
  background: '#dc2626',
  color: '#ffffff',
  border: 'none',
  borderRadius: 12,
  padding: '10px 20px',
  fontFamily: 'var(--font-headline)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
}

function translateError(err: string, t: ReturnType<typeof useTranslations<'app.settings.twoFactor'>>): string {
  switch (err) {
    case 'invalid_code': return t('errorInvalidCode')
    case 'setup_expired': return t('errorExpired')
    case 'mfa_required': return t('errorMfaRequired')
    case 'already_enabled': return t('errorAlreadyEnabled')
    case 'not_enabled': return t('errorNotEnabled')
    default: return t('errorUnknown')
  }
}

export function TwoFactorSection({
  totpEnabled,
  requiresMfa,
  backupCodesRemaining,
}: {
  totpEnabled: boolean
  requiresMfa: boolean
  backupCodesRemaining: number
}) {
  const t = useTranslations('app.settings.twoFactor')
  const router = useRouter()
  const { update } = useSession()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<Mode>('idle')
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [copiedKey, setCopiedKey] = useState<'secret' | 'codes' | null>(null)

  const reset = () => {
    setMode('idle')
    setSetupData(null)
    setCode('')
    setError(null)
    setBackupCodes(null)
  }

  const startSetup = () => {
    setError(null)
    startTransition(async () => {
      const result = await initTotpSetup()
      if (!result.success) { setError(translateError(result.error, t)); return }
      setSetupData({ secret: result.secret, uri: result.uri, qrDataUrl: result.qrDataUrl })
      setMode('setup')
    })
  }

  const submitSetup = () => {
    setError(null)
    startTransition(async () => {
      const result = await confirmTotpSetup(code)
      if (!result.success) { setError(translateError(result.error, t)); return }
      setBackupCodes(result.backupCodes)
      setMode('backupReveal')
      setCode('')
      await update({ totpEnabled: true })
      router.refresh()
    })
  }

  const submitDisable = () => {
    setError(null)
    startTransition(async () => {
      const result = await disableTotp(code)
      if (!result.success) { setError(translateError(result.error, t)); return }
      reset()
      await update({ totpEnabled: false })
      router.refresh()
    })
  }

  const submitRegenerate = () => {
    setError(null)
    startTransition(async () => {
      const result = await regenerateBackupCodes(code)
      if (!result.success) { setError(translateError(result.error, t)); return }
      setBackupCodes(result.backupCodes)
      setMode('backupReveal')
      setCode('')
      router.refresh()
    })
  }

  const copyText = async (text: string, key: 'secret' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch { /* ignore */ }
  }

  const downloadCodes = () => {
    if (!backupCodes) return
    const blob = new Blob([backupCodes.join('\n') + '\n'], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dice-vault-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 className="font-headline font-black text-base" style={{ color: '#1e1a14', marginBottom: 4 }}>{t('title')}</h2>
          <p className="font-body text-sm" style={{ color: '#9a8878' }}>{t('description')}</p>
        </div>
        <StatusPill enabled={totpEnabled} t={t} />
      </div>

      {!totpEnabled && requiresMfa && mode === 'idle' && (
        <p className="font-body text-sm px-4 py-2.5 rounded-xl mb-4" style={{ background: '#fef9e7', color: '#92400e', border: '1px solid #fde68a' }}>
          {t('requiredWarning')}
        </p>
      )}

      {mode === 'idle' && totpEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="font-body text-sm" style={{ color: '#9a8878' }}>
            {t('backupCodesRemaining', { count: backupCodesRemaining })}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setMode('regenerate'); setError(null) }} style={secondaryButton}>
              {t('regenerateButton')}
            </button>
            {!requiresMfa && (
              <button type="button" onClick={() => { setMode('disable'); setError(null) }} style={dangerButton}>
                {t('disableButton')}
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'idle' && !totpEnabled && (
        <button type="button" onClick={startSetup} disabled={pending} style={primaryButton}>
          {pending ? '…' : t('enableButton')}
        </button>
      )}

      {mode === 'setup' && setupData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
          <div>
            <h3 className="font-headline font-bold text-sm" style={{ color: '#1e1a14', marginBottom: 4 }}>{t('setupTitle')}</h3>
            <p className="font-body text-sm" style={{ color: '#9a8878' }}>{t('setupSubtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ background: '#ffffff', padding: 12, borderRadius: 16, border: '1px solid #e8e1d8', flexShrink: 0 }}>
              <Image src={setupData.qrDataUrl} alt="TOTP QR code" width={200} height={200} unoptimized />
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="font-headline font-semibold text-xs" style={{ color: '#9a8878' }}>{t('setupSecretLabel')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <code style={{ flex: 1, padding: '10px 14px', background: '#f5f0e8', border: '1px solid #e8e1d8', borderRadius: 12, fontSize: 13, color: '#1e1a14', letterSpacing: 1, wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>
                  {setupData.secret}
                </code>
                <button type="button" onClick={() => copyText(setupData.secret, 'secret')} style={secondaryButton}>
                  {copiedKey === 'secret' ? t('copied') : t('copy')}
                </button>
              </div>
              <label className="font-headline font-semibold text-xs mt-2" style={{ color: '#9a8878' }}>{t('codeInputLabel')}</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\s/g, ''))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={10}
                style={inputStyle}
              />
              {error && <p className="font-body text-xs" style={{ color: '#dc2626' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={submitSetup} disabled={pending || code.length < 6} style={{ ...primaryButton, opacity: pending || code.length < 6 ? 0.6 : 1 }}>
                  {pending ? '…' : t('verifyButton')}
                </button>
                <button type="button" onClick={reset} style={secondaryButton}>{t('cancelButton')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(mode === 'disable' || mode === 'regenerate') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <h3 className="font-headline font-bold text-sm" style={{ color: '#1e1a14', marginBottom: 4 }}>
              {mode === 'disable' ? t('disableTitle') : t('regenerateTitle')}
            </h3>
            <p className="font-body text-sm" style={{ color: '#9a8878' }}>
              {mode === 'disable' ? t('disableSubtitle') : t('regenerateSubtitle')}
            </p>
          </div>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\s/g, ''))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={20}
            style={inputStyle}
          />
          {error && <p className="font-body text-xs" style={{ color: '#dc2626' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={mode === 'disable' ? submitDisable : submitRegenerate}
              disabled={pending || code.length < 6}
              style={{ ...(mode === 'disable' ? dangerButton : primaryButton), opacity: pending || code.length < 6 ? 0.6 : 1 }}
            >
              {pending ? '…' : (mode === 'disable' ? t('confirmDisable') : t('confirmRegenerate'))}
            </button>
            <button type="button" onClick={reset} style={secondaryButton}>{t('cancelButton')}</button>
          </div>
        </div>
      )}

      {mode === 'backupReveal' && backupCodes && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <h3 className="font-headline font-bold text-sm" style={{ color: '#1e1a14', marginBottom: 4 }}>{t('backupTitle')}</h3>
            <p className="font-body text-sm" style={{ color: '#9a8878' }}>{t('backupSubtitle')}</p>
          </div>
          <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, listStyle: 'none', margin: 0, padding: 16, background: '#fdf6e9', border: '1px dashed #e6d2a3', borderRadius: 16 }}>
            {backupCodes.map(c => (
              <li key={c} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, color: '#1e1a14', letterSpacing: 1 }}>{c}</li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => copyText(backupCodes.join('\n'), 'codes')} style={secondaryButton}>
              {copiedKey === 'codes' ? t('copied') : t('copy')}
            </button>
            <button type="button" onClick={downloadCodes} style={secondaryButton}>{t('downloadButton')}</button>
            <button type="button" onClick={reset} style={primaryButton}>{t('doneButton')}</button>
          </div>
        </div>
      )}
    </section>
  )
}

function StatusPill({ enabled, t }: { enabled: boolean; t: ReturnType<typeof useTranslations<'app.settings.twoFactor'>> }) {
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '4px 12px',
        borderRadius: 999,
        fontFamily: 'var(--font-headline)',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        background: enabled ? 'rgba(22,163,74,0.12)' : 'rgba(154,136,120,0.12)',
        color: enabled ? '#15803d' : '#9a8878',
        border: `1px solid ${enabled ? 'rgba(22,163,74,0.25)' : '#e8e1d8'}`,
      }}
    >
      {enabled ? t('statusEnabled') : t('statusDisabled')}
    </span>
  )
}
