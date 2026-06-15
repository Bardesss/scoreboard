'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { saveMailgunConfig, testMailgunConnection, testUmamiConnection } from './actions'
import type { MailgunStats } from './actions'
import { Lock, Eye, EyeOff } from 'lucide-react'

type IntegrationRow = {
  status: string
  lastTestedAt: string | null
  lastError: string | null
  apiKey: string
  domain: string
  from: string
  region: 'eu' | 'us'
}

const card: React.CSSProperties = {
  background: '#161f28',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.8)',
  borderRadius: 10,
  padding: '8px 14px',
  outline: 'none',
  fontSize: 14,
  width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'rgba(255,255,255,0.35)',
  display: 'block',
  marginBottom: 6,
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    unconfigured: { label: 'Niet geconfigureerd', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)' },
    ok:           { label: 'Verbonden',           color: '#4ade80',               bg: 'rgba(34,197,94,0.12)' },
    error:        { label: 'Fout',                color: '#f87171',               bg: 'rgba(248,113,113,0.12)' },
    warning:      { label: 'Aandacht nodig',       color: '#fbbf24',               bg: 'rgba(251,191,36,0.12)' },
  }
  const s = map[status] ?? map.unconfigured
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function StubCard({ name, icon }: { name: string; icon: string }) {
  return (
    <div style={{ ...card, opacity: 0.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
            Beschikbaar in Fase 7
          </span>
          <Lock size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsClient({
  mailgun,
  mailgunStats,
  umami,
}: {
  mailgun: IntegrationRow | null
  mailgunStats: MailgunStats | null
  umami: { configured: boolean }
}) {
  const router = useRouter()
  const [apiKey, setApiKey]   = useState(mailgun?.apiKey ?? '')
  const [domain, setDomain]   = useState(mailgun?.domain ?? '')
  const [from, setFrom]       = useState(mailgun?.from ?? '')
  const [region, setRegion]   = useState<'eu' | 'us'>(mailgun?.region ?? 'eu')
  const [showApiKey, setShowApiKey] = useState(false)
  const [liveStats, setLiveStats] = useState<MailgunStats | null>(mailgunStats)
  const [liveStatus, setLiveStatus] = useState(mailgun?.status ?? 'unconfigured')
  const [liveError, setLiveError]   = useState(mailgun?.lastError ?? null)

  const [isSaving, startSave]   = useTransition()
  const [isTesting, startTest]  = useTransition()

  const [umamiStatus, setUmamiStatus] = useState<'ok' | 'warning' | 'error' | 'unconfigured'>('unconfigured')
  const [umamiMessage, setUmamiMessage] = useState<string | null>(null)
  const [isTestingUmami, startTestUmami] = useTransition()

  function handleTestUmami() {
    startTestUmami(async () => {
      const result = await testUmamiConnection()
      setUmamiStatus(result.status)
      setUmamiMessage(result.message)
      if (result.success) toast.success('Umami verbonden')
      else toast.error(result.message)
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startSave(async () => {
      const result = await saveMailgunConfig({ apiKey, domain, from, region })
      if (result.success) {
        toast.success('Mailgun configuratie opgeslagen')
        setLiveStatus('unconfigured')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Opslaan mislukt')
      }
    })
  }

  function handleTest() {
    startTest(async () => {
      const result = await testMailgunConnection()
      if (result.success && result.stats) {
        setLiveStats(result.stats)
        setLiveStatus('ok')
        setLiveError(null)
        toast.success('Verbinding geslaagd')
      } else {
        setLiveStatus('error')
        setLiveError(result.error ?? 'Onbekende fout')
        toast.error(result.error ?? 'Verbinding mislukt')
      }
    })
  }

  const btnStyle = (color: string, disabled: boolean): React.CSSProperties => ({
    background: disabled ? 'rgba(255,255,255,0.05)' : color,
    color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
    border: 'none', borderRadius: 10, padding: '8px 16px',
    fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div style={{ maxWidth: 640 }}>
      <h1
        className="font-headline"
        style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4, letterSpacing: '-0.02em' }}
      >
        Integraties
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
        Configureer externe diensten. Gegevens worden versleuteld opgeslagen.
      </p>

      {/* Mailgun card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✉️</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>Mailgun</span>
          </div>
          <StatusBadge status={liveStatus} />
        </div>

        {liveStatus === 'error' && liveError && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f87171' }}>
            {liveError}
          </div>
        )}

        {liveStatus === 'ok' && liveStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
            {[
              { label: 'Verzonden (30d)', value: liveStats.sent },
              { label: 'Bezorgd', value: liveStats.delivered },
              { label: 'Mislukt', value: liveStats.failed },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {liveStatus === 'ok' && !liveStats && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
            Klik Test om statistieken te vernieuwen.
          </p>
        )}

        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
            <div>
              <label style={labelStyle}>API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="key-..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  aria-label={showApiKey ? 'Verberg API key' : 'Toon API key'}
                  style={{
                    position: 'absolute', top: 0, right: 0, height: '100%',
                    width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Domain</label>
              <input
                type="text"
                placeholder="mg.yourdomain.com"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>From address</label>
            <input
              type="text"
              placeholder="Dice Vault <noreply@yourdomain.com>"
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Regio</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['eu', 'us'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
                  style={{
                    padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: region === r ? 'rgba(74,142,255,0.2)' : 'rgba(255,255,255,0.05)',
                    color: region === r ? '#4a8eff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={isSaving} style={btnStyle('#005bc0', isSaving)}>
              {isSaving ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !mailgun}
              style={btnStyle('rgba(255,255,255,0.1)', isTesting || !mailgun)}
            >
              {isTesting ? 'Testen…' : 'Test verbinding'}
            </button>
          </div>
        </form>
      </div>

      {/* Umami card — env-configured, read-only status + test */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.87)' }}>Umami Analytics</span>
          </div>
          <StatusBadge status={umamiStatus} />
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>
          Geconfigureerd via omgevingsvariabelen (<code>UMAMI_URL</code>, <code>UMAMI_INTERNAL_URL</code>,{' '}
          <code>UMAMI_WEBSITE_ID</code>, <code>UMAMI_USERNAME</code>, <code>UMAMI_PASSWORD</code>). Voedt het
          dashboard-paneel "Website-analyse".
        </p>

        {!umami.configured && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Nog niet geconfigureerd — stel de <code>UMAMI_*</code> variabelen in.
          </div>
        )}

        {umamiMessage && (
          <div
            style={{
              background: umamiStatus === 'error' ? 'rgba(248,113,113,0.1)' : umamiStatus === 'warning' ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)',
              border: `1px solid ${umamiStatus === 'error' ? 'rgba(248,113,113,0.2)' : umamiStatus === 'warning' ? 'rgba(251,191,36,0.2)' : 'rgba(74,222,128,0.2)'}`,
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 14,
              fontSize: 13,
              color: umamiStatus === 'error' ? '#f87171' : umamiStatus === 'warning' ? '#fbbf24' : '#4ade80',
            }}
          >
            {umamiMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleTestUmami}
          disabled={isTestingUmami || !umami.configured}
          style={btnStyle('rgba(255,255,255,0.1)', isTestingUmami || !umami.configured)}
        >
          {isTestingUmami ? 'Testen…' : 'Test verbinding'}
        </button>
      </div>

      <StubCard name="Mollie" icon="💳" />
      <StubCard name="Stripe" icon="⚡" />
      <StubCard name="Strike" icon="₿" />
    </div>
  )
}
