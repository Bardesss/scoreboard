import type { AggregatorGame, AggregatorMember, HeadToHeadMatrix } from './types'

export function computeHeadToHead(games: AggregatorGame[], members: AggregatorMember[]): HeadToHeadMatrix {
  const players = members.map(m => ({ id: m.playerId, name: m.name, avatarSeed: m.avatarSeed }))
  const idx: Record<string, number> = {}
  players.forEach((p, i) => { idx[p.id] = i })
  const n = players.length
  const cells: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (const g of games) {
    // g.scores is invariant-ordered score-desc; keep order while filtering.
    const inGame = g.scores.filter(s => idx[s.playerId] !== undefined)
    for (let i = 0; i < inGame.length; i++) {
      for (let j = i + 1; j < inGame.length; j++) {
        const a = idx[inGame[i].playerId]
        const b = idx[inGame[j].playerId]
        cells[a][b]++
      }
    }
  }
  return { players, cells }
}
