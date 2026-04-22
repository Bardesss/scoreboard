import { prisma } from '@/lib/prisma'

type Purchase = {
  id: string
  invoiceNumber: string | null
  createdAt: Date
  customerCountry: string | null
  currency: string
  amountCents: number
  eurAmountCents: number | null
  exchangeRate: unknown
  exchangeRateSource: string | null
  vatTreatment: string | null
  provider: string
}

function vatRate(vatTreatment: string | null): number {
  if (vatTreatment === 'NL_21' || vatTreatment === 'EU_OSS') return 0.21
  return 0
}

function obBox(vatTreatment: string | null): string {
  if (!vatTreatment) return '—'
  if (vatTreatment === 'NL_21') return '1a'
  if (vatTreatment === 'EU_REVERSE_CHARGE') return '3b'
  if (vatTreatment === 'EU_OSS') return '1a (OSS)'
  if (vatTreatment === 'EXPORT') return '3a'
  return '—'
}

function fmtEur(cents: number | null): string {
  if (cents === null) return '—'
  return `€ ${(cents / 100).toFixed(2)}`
}

export default async function TaxExportPage() {
  const purchases = await prisma.creditPurchase.findMany({
    where: { status: 'paid' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, invoiceNumber: true, createdAt: true, customerCountry: true,
      currency: true, amountCents: true, eurAmountCents: true,
      exchangeRate: true, exchangeRateSource: true, vatTreatment: true, provider: true,
    },
  }) as Purchase[]

  // Aggregate per OB box
  const boxes: Record<string, { turnoverCents: number; vatCents: number }> = {}
  for (const p of purchases) {
    const box = obBox(p.vatTreatment)
    const eur = p.eurAmountCents ?? 0
    const rate = vatRate(p.vatTreatment)
    const turnover = Math.round(eur / (1 + rate))
    const vat = eur - turnover
    if (!boxes[box]) boxes[box] = { turnoverCents: 0, vatCents: 0 }
    boxes[box].turnoverCents += turnover
    boxes[box].vatCents += vat
  }

  const thStyle = { textAlign: 'left' as const, padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' as const }

  return (
    <div style={{ maxWidth: 960 }}>
      <h1
        className="font-headline"
        style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.87)', marginBottom: 4, letterSpacing: '-0.02em' }}
      >
        Belastingexport (OB)
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
        OB-overzicht voor de Belastingdienst. Alle betaalde aankopen, cumulatief.
      </p>

      {purchases.length === 0 ? (
        <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>Nog geen betaalde aankopen.</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
            Gegevens verschijnen hier zodra betalingen worden verwerkt (Fase 7).
          </p>
        </div>
      ) : (
        <>
          {/* OB summary table */}
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Samenvatting OB-vakken</p>
          <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['OB-vak', 'Omschrijving', 'Omzet excl. BTW', 'BTW'].map(h => (
                    <th key={h} className="font-headline" style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(boxes).map(([box, { turnoverCents, vatCents }], i, arr) => (
                  <tr key={box}>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.87)', fontWeight: 700, fontSize: 13.5, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{box}</td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13.5, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      {box === '1a' ? 'Binnenlands NL 21%' : box === '3b' ? 'Intra-EU verlegging' : box === '3a' ? 'Export buiten EU' : 'Overig'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13.5, fontWeight: 600, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{fmtEur(turnoverCents)}</td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13.5, fontWeight: 600, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{fmtEur(vatCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed transaction list */}
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Transactieoverzicht</p>
          <div style={{ background: '#161f28', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Factuur', 'Datum', 'Land', 'Valuta', 'Bedrag', 'EUR excl. BTW', 'BTW%', 'BTW €', 'OB-vak', 'Methode'].map(h => (
                      <th key={h} className="font-headline" style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p, i) => {
                    const rate = vatRate(p.vatTreatment)
                    const eur = p.eurAmountCents ?? 0
                    const turnover = Math.round(eur / (1 + rate))
                    const vat = eur - turnover
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13, whiteSpace: 'nowrap', borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.invoiceNumber ?? '—'}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, whiteSpace: 'nowrap', borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.createdAt.toLocaleDateString('nl-NL')}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.customerCountry ?? '—'}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.currency}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{(p.amountCents / 100).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{fmtEur(turnover)}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{(rate * 100).toFixed(0)}%</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.87)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{fmtEur(vat)}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{obBox(p.vatTreatment)}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, textTransform: 'capitalize', borderBottom: i < purchases.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>{p.provider}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 24, lineHeight: 1.6 }}>
            Dit rapport converteert alle betalingen (inclusief Bitcoin) naar euro&apos;s zoals vereist door de Belastingdienst.
            Controleer altijd wisselkoersen en bewaar bewijs van de gebruikte koersen.
            Voor crypto: documenteer de marktwaarde op het moment van facturering of betaling.
            Dit is geen officieel belastingadvies.
          </p>
        </>
      )}
    </div>
  )
}
