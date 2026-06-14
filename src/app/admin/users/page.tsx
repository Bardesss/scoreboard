import type { CSSProperties } from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const PAGE_SIZE = 50

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { q, page: pageParam } = await searchParams

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { username: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const total = await prisma.user.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Number(pageParam) || 1))

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      monthlyCredits: true,
      permanentCredits: true,
      isLifetimeFree: true,
      requiresMfa: true,
      totpEnabled: true,
      emailVerified: true,
      createdAt: true,
    },
  })

  return (
    <div>
      {/* Page title */}
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
        Gebruikers
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
        Beheer accounts, credits en rechten
      </p>

      {/* Search form */}
      <form
        method="GET"
        style={{ display: 'flex', gap: 8, marginBottom: 24 }}
      >
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Zoek op e-mail of gebruikersnaam…"
          style={{
            flex: 1,
            maxWidth: 400,
            background: '#161f28',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '9px 14px',
            fontSize: 13.5,
            color: 'rgba(255,255,255,0.87)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            background: '#4a8eff',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Zoeken
        </button>
        {q && (
          <Link
            href="/admin/users"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '9px 14px',
              fontSize: 13,
              color: 'rgba(255,255,255,0.45)',
              textDecoration: 'none',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Wissen
          </Link>
        )}
      </form>

      {/* Count */}
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
        {total} gebruiker{total !== 1 ? 's' : ''} gevonden
        {total > PAGE_SIZE && ` · pagina ${page} van ${pageCount}`}
      </p>

      {/* Table */}
      <div
        style={{
          background: '#161f28',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
       <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              {['Gebruiker', 'Credits', 'Badges', 'Aangemaakt', 'Acties'].map((col) => (
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
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  Geen gebruikers gevonden.
                </td>
              </tr>
            ) : (
              users.map((user, i) => (
                <tr
                  key={user.id}
                  style={{ transition: 'background 0.1s' }}
                  onMouseEnter={undefined}
                >
                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < users.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      fontSize: 13.5,
                    }}
                  >
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.87)', fontWeight: 500 }}>
                      {user.email}
                    </div>
                    {user.username && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: 3,
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.45)',
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: 5,
                          padding: '1px 7px',
                        }}
                      >
                        @{user.username}
                      </span>
                    )}
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < users.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      fontSize: 13.5,
                      color: 'rgba(255,255,255,0.7)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600 }}>
                      {user.monthlyCredits}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginLeft: 2 }}>
                      mnd
                    </span>
                    {user.permanentCredits > 0 && (
                      <span style={{ marginLeft: 8 }}>
                        <span style={{ color: '#4ade80', fontWeight: 600 }}>
                          +{user.permanentCredits}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginLeft: 2 }}>
                          perm
                        </span>
                      </span>
                    )}
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < users.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {user.role === 'admin' && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(0,91,192,0.2)',
                            color: '#4a8eff',
                            border: '1px solid rgba(0,91,192,0.3)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Admin
                        </span>
                      )}
                      {user.isLifetimeFree && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(34,197,94,0.15)',
                            color: '#4ade80',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Lifetime
                        </span>
                      )}
                      {user.requiresMfa && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.07)',
                            color: 'rgba(255,255,255,0.5)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          MFA vereist
                        </span>
                      )}
                      {user.totpEnabled && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.07)',
                            color: 'rgba(255,255,255,0.5)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          TOTP aan
                        </span>
                      )}
                    </div>
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < users.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.45)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new Date(user.createdAt).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  <td
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < users.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <Link
                      href={`/admin/users/${user.id}`}
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#4a8eff',
                        textDecoration: 'none',
                        padding: '5px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(74,142,255,0.25)',
                        background: 'rgba(74,142,255,0.07)',
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Bekijken →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
       </div>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
          <PageLink q={q} page={page - 1} disabled={page <= 1} label="← Vorige" />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            {page} / {pageCount}
          </span>
          <PageLink q={q} page={page + 1} disabled={page >= pageCount} label="Volgende →" />
        </div>
      )}
    </div>
  )
}

function PageLink({ q, page, disabled, label }: { q?: string; page: number; disabled: boolean; label: string }) {
  const style: CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
    background: '#161f28',
    textDecoration: 'none',
    pointerEvents: disabled ? 'none' : 'auto',
  }
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('page', String(page))
  if (disabled) return <span style={style}>{label}</span>
  return (
    <Link href={`/admin/users?${params.toString()}`} style={style}>
      {label}
    </Link>
  )
}
