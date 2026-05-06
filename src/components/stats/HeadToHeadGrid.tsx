import { Avatar } from '@/components/shared/Avatar'
import type { HeadToHeadMatrix } from '@/lib/stats/types'

export function HeadToHeadGrid({ matrix }: { matrix: HeadToHeadMatrix }) {
  const { players, cells } = matrix
  const n = players.length

  return (
    <>
      {/* Desktop grid */}
      <div className="hidden sm:block" style={{ padding: '12px 18px', overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th></th>
              {players.map(p => (
                <th key={p.id} style={{ padding: '4px 6px', fontWeight: 600, color: '#6b5e4a', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 80 }}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((row, i) => (
              <tr key={row.id}>
                <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 600, color: '#1e1a14' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar seed={row.avatarSeed} name={row.name} size={20} />{row.name}
                  </div>
                </th>
                {players.map((col, j) => {
                  const v = cells[i][j]
                  const colV = cells[j][i]
                  const leads = v > colV
                  const equal = i === j
                  return (
                    <td key={col.id} style={{
                      padding: '4px 6px', textAlign: 'center', minWidth: 30,
                      border: '1px solid #ede5d8',
                      background: equal ? '#f2ece3' : leads ? 'rgba(245,166,35,0.15)' : '#fefcf8',
                      color: equal ? '#c4b79a' : '#1e1a14',
                    }}>
                      {equal ? '—' : v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile per-player list */}
      <div className="sm:hidden" style={{ padding: '0 18px' }}>
        {players.map((p, i) => {
          let best = { opponent: '', w: 0, l: 0 }
          let worst = { opponent: '', w: 99, l: 0 }
          for (let j = 0; j < n; j++) {
            if (i === j) continue
            const w = cells[i][j]
            const l = cells[j][i]
            const diff = w - l
            if (w + l > 0 && diff > best.w - best.l) best = { opponent: players[j].name, w, l }
            if (w + l > 0 && diff < worst.w - worst.l) worst = { opponent: players[j].name, w, l }
          }
          return (
            <div key={p.id} style={{ padding: '11px 0', borderBottom: i < n - 1 ? '1px solid #f2ece3' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar seed={p.avatarSeed} name={p.name} size={22} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e1a14' }}>{p.name}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b5e4a' }}>
                {best.opponent && <>Beste: <strong>{best.opponent}</strong> ({best.w}–{best.l}) · </>}
                {worst.opponent && <>Slechtste: <strong>{worst.opponent}</strong> ({worst.w}–{worst.l})</>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
