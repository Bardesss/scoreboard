import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Trophy } from 'lucide-react'

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const pg = await prisma.playedGame.findUnique({
    where: { shareToken: token },
    include: {
      league: { select: { name: true, gameTemplate: { select: { name: true } } } },
      scores: {
        include: { player: { select: { name: true } } },
        orderBy: { score: 'desc' },
      },
    },
  })

  if (!pg || pg.status !== 'approved') notFound()

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f5f0e8' }}>
      <div className="w-full max-w-sm rounded-3xl p-6 shadow-lg" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.12)' }}>
            <Trophy size={20} style={{ color: '#f5a623' }} />
          </div>
          <div>
            <p className="font-headline font-black text-base" style={{ color: '#1c1810' }}>{pg.league.name}</p>
            <p className="font-body text-xs" style={{ color: '#9a8878' }}>{pg.league.gameTemplate.name}</p>
          </div>
        </div>

        <p className="font-body text-xs mb-4" style={{ color: '#9a8878' }}>
          {new Date(pg.playedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
        </p>

        <ul className="space-y-2">
          {pg.scores.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: i === 0 ? 'rgba(245,166,35,0.08)' : '#f5f0e8' }}>
              <span className="font-headline font-black text-sm w-5" style={{ color: i === 0 ? '#f5a623' : '#c4b79a' }}>#{i + 1}</span>
              <span className="flex-1 font-headline font-semibold text-sm" style={{ color: '#1c1810' }}>{s.player.name}</span>
              <span className="font-headline font-bold text-sm" style={{ color: '#4a3f2f' }}>{s.score}</span>
            </li>
          ))}
        </ul>

        {pg.notes && (
          <p className="mt-4 text-xs font-body italic" style={{ color: '#9a8878' }}>{pg.notes}</p>
        )}

        <p className="mt-6 text-center text-xs font-body" style={{ color: '#c4b79a' }}>Logged with Dice Vault</p>
      </div>
    </div>
  )
}
