import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { deletePage } from './actions'

async function deletePageFormAction(id: string): Promise<void> {
  'use server'
  await deletePage(id)
}

export default async function AdminPagesPage() {
  const pages = await prisma.page.findMany({
    orderBy: { order: 'asc' },
  })

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            className="font-headline"
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.87)',
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}
          >
            Pagina&apos;s
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            Beheer statische pagina&apos;s en juridische teksten
          </p>
        </div>

        <Link
          href="/admin/pages/new"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            textDecoration: 'none',
            padding: '9px 18px',
            borderRadius: 10,
            background: '#005bc0',
            whiteSpace: 'nowrap',
          }}
        >
          + Nieuwe pagina
        </Link>
      </div>

      <div
        style={{
          background: '#161f28',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Titel', 'Slug', 'Status', 'Volgorde', 'Systeem', 'Acties'].map((col) => (
                <th
                  key={col}
                  className="font-headline"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    padding: '12px 16px',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  Geen pagina&apos;s gevonden.
                </td>
              </tr>
            ) : (
              pages.map((page, i) => (
                <tr key={page.id}>
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < pages.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      fontSize: 13.5,
                      color: 'rgba(255,255,255,0.87)',
                      fontWeight: 500,
                    }}
                  >
                    {page.titleNl}
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < pages.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: 'rgba(255,255,255,0.55)',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 5,
                        padding: '2px 8px',
                      }}
                    >
                      {page.slug}
                    </span>
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < pages.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: 6,
                        background: page.published
                          ? 'rgba(34,197,94,0.15)'
                          : 'rgba(255,255,255,0.07)',
                        color: page.published ? '#4ade80' : 'rgba(255,255,255,0.45)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {page.published ? 'Gepubliceerd' : 'Concept'}
                    </span>
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < pages.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.55)',
                      textAlign: 'center',
                    }}
                  >
                    {page.order}
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < pages.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      textAlign: 'center',
                    }}
                  >
                    {page.isSystem && (
                      <span
                        title="Systeempagina"
                        style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }}
                      >
                        🔒
                      </span>
                    )}
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < pages.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Link
                        href={`/admin/pages/${page.id}`}
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#4a8eff',
                          textDecoration: 'none',
                          padding: '5px 12px',
                          borderRadius: 8,
                          border: '1px solid rgba(74,142,255,0.25)',
                          background: 'rgba(74,142,255,0.07)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Bewerken →
                      </Link>

                      {!page.isSystem && (
                        <form action={deletePageFormAction.bind(null, page.id)}>
                          <button
                            type="submit"
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: '#ff6b6b',
                              background: 'rgba(159,64,61,0.15)',
                              border: '1px solid rgba(159,64,61,0.3)',
                              borderRadius: 8,
                              padding: '5px 12px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Verwijderen
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
