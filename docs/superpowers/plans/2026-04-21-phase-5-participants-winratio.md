# Phase 5 — Participants, Win Ratio & Session Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-phase participant selection to the log form, datetime-local input, per-player win ratio on the league page and dashboard, and edit/delete for sessions.

**Architecture:** All game-related server actions live in `src/app/app/leagues/[id]/actions.ts`. The log form becomes a two-phase client component (participant picker → scores/winner) and gains an edit mode via `?edit=<sessionId>` query param. Win ratio is computed server-side from existing `ScoreEntry` data with no schema changes. Delete/edit buttons on the league page use a new `SessionActions` client island for inline confirmation state.

**Tech Stack:** Next.js 15 App Router, Prisma 5, React 19 client components, next-intl, Sonner toasts, Vitest for server action tests.

---

## File Map

| Action | Path |
|---|---|
| Modify | `messages/en/app.json` |
| Modify | `messages/nl/app.json` |
| Modify | `src/app/api/app/leagues/[id]/members/route.ts` |
| Create | `src/app/api/app/leagues/[id]/sessions/[sessionId]/route.ts` |
| Modify | `src/app/app/leagues/[id]/actions.ts` |
| Create | `src/test/leagues-session-actions.test.ts` |
| Modify | `src/app/app/leagues/[id]/log/page.tsx` |
| Create | `src/app/app/leagues/[id]/SessionActions.tsx` |
| Modify | `src/app/app/leagues/[id]/page.tsx` |
| Modify | `src/app/app/dashboard/page.tsx` |

---

### Task 1: Add i18n keys for all new strings

**Files:**
- Modify: `messages/en/app.json`
- Modify: `messages/nl/app.json`

- [ ] **Step 1: Add new keys to `messages/en/app.json`**

Inside the `"playedGames"` object add these keys:

```json
"selectParticipants": "Select participants",
"playersSelected": "{count} players selected",
"playerHint": "{min}–{max} players",
"minPlayersNote": "Select at least {min} players to continue",
"maxPlayersNote": "Select at most {max} players to continue",
"continue": "Continue →",
"back": "← Back",
"saveChanges": "Save changes",
"saving": "Saving..."
```

Inside the `"leagues"` object add:

```json
"winsStats": "{wins}W / {games}G — {ratio}%",
"deleteSessionConfirm": "Delete this session? This cannot be undone.",
"deleteSessionCancel": "Cancel",
"deleteSessionConfirmBtn": "Delete",
"deleting": "Deleting..."
```

Inside the `"toasts"` object add:

```json
"sessionUpdated": "Session updated.",
"sessionDeleted": "Session deleted."
```

Inside the `"dashboard"` object add:

```json
"winRatio": "{ratio}%"
```

- [ ] **Step 2: Add the same keys to `messages/nl/app.json`**

Inside `"playedGames"`:

```json
"selectParticipants": "Selecteer deelnemers",
"playersSelected": "{count} spelers geselecteerd",
"playerHint": "{min}–{max} spelers",
"minPlayersNote": "Selecteer minimaal {min} spelers om door te gaan",
"maxPlayersNote": "Selecteer maximaal {max} spelers om door te gaan",
"continue": "Doorgaan →",
"back": "← Terug",
"saveChanges": "Wijzigingen opslaan",
"saving": "Opslaan..."
```

Inside `"leagues"`:

```json
"winsStats": "{wins}W / {games}P — {ratio}%",
"deleteSessionConfirm": "Sessie verwijderen? Dit kan niet ongedaan worden gemaakt.",
"deleteSessionCancel": "Annuleren",
"deleteSessionConfirmBtn": "Verwijderen",
"deleting": "Verwijderen..."
```

Inside `"toasts"`:

```json
"sessionUpdated": "Sessie bijgewerkt.",
"sessionDeleted": "Sessie verwijderd."
```

Inside `"dashboard"`:

```json
"winRatio": "{ratio}%"
```

- [ ] **Step 3: Commit**

```bash
git add messages/en/app.json messages/nl/app.json
git commit -m "feat(i18n): add phase 5 translation keys"
```

---

### Task 2: Members API — expose minPlayers and maxPlayers

**Files:**
- Modify: `src/app/api/app/leagues/[id]/members/route.ts`

The `GET /api/app/leagues/[id]/members` endpoint currently returns `{ members, winType, missions, scoreFields }`. The log form needs `minPlayers` and `maxPlayers` from the linked `GameTemplate` to enforce participant count validation.

- [ ] **Step 1: Update the Prisma query to include minPlayers/maxPlayers**

Replace the `gameTemplate: { select: { winType: true, missions: true, scoreFields: true } }` select with:

```ts
gameTemplate: { select: { winType: true, missions: true, scoreFields: true, minPlayers: true, maxPlayers: true } },
```

- [ ] **Step 2: Include the fields in the response**

Replace the final `return NextResponse.json(...)` line with:

```ts
return NextResponse.json({
  members,
  winType: league.gameTemplate.winType,
  missions: league.gameTemplate.missions,
  scoreFields: league.gameTemplate.scoreFields,
  minPlayers: league.gameTemplate.minPlayers,
  maxPlayers: league.gameTemplate.maxPlayers,
})
```

The full updated file:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      gameTemplate: {
        select: { winType: true, missions: true, scoreFields: true, minPlayers: true, maxPlayers: true },
      },
    },
  })
  if (!league || league.ownerId !== session.user.id) return NextResponse.json([], { status: 403 })

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: id },
    include: { player: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    members,
    winType: league.gameTemplate.winType,
    missions: league.gameTemplate.missions,
    scoreFields: league.gameTemplate.scoreFields,
    minPlayers: league.gameTemplate.minPlayers,
    maxPlayers: league.gameTemplate.maxPlayers,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/app/leagues/[id]/members/route.ts
git commit -m "feat(api): expose minPlayers/maxPlayers on members endpoint"
```

---

### Task 3: Session GET API for edit pre-population

**Files:**
- Create: `src/app/api/app/leagues/[id]/sessions/[sessionId]/route.ts`

The edit form needs to pre-populate state from an existing `PlayedGame`. This endpoint returns the data in the format the log form needs.

- [ ] **Step 1: Create the route file**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { id, sessionId } = await params
  const session = await auth()
  if (!session) return NextResponse.json(null, { status: 401 })

  const league = await prisma.league.findUnique({ where: { id } })
  if (!league || league.ownerId !== session.user.id) return NextResponse.json(null, { status: 403 })

  const pg = await prisma.playedGame.findUnique({
    where: { id: sessionId, leagueId: id },
    include: { scores: { include: { player: { select: { id: true } } } } },
  })
  if (!pg) return NextResponse.json(null, { status: 404 })

  // Derive winner for winner-type games (score = 1 means winner)
  const winner = pg.scores.find(s => s.score === 1)

  // Build local datetime string for datetime-local input (YYYY-MM-DDTHH:MM)
  const d = pg.playedAt
  const pad = (n: number) => String(n).padStart(2, '0')
  const playedAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

  return NextResponse.json({
    playedAt: playedAtLocal,
    notes: pg.notes ?? '',
    winningMission: pg.winningMission ?? '',
    participantIds: pg.scores.map(s => s.playerId),
    scores: pg.scores.map(s => ({ playerId: s.playerId, score: s.score })),
    winnerId: winner?.playerId ?? '',
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/app/leagues/[id]/sessions/[sessionId]/route.ts
git commit -m "feat(api): add session GET endpoint for edit pre-population"
```

---

### Task 4: Server actions — editPlayedGame and deletePlayedGame (TDD)

**Files:**
- Modify: `src/app/app/leagues/[id]/actions.ts`
- Create: `src/test/leagues-session-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/test/leagues-session-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    playedGame: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    scoreEntry: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/redis', () => ({ redis: { del: vi.fn() } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { editPlayedGame, deletePlayedGame } from '@/app/app/leagues/[id]/actions'

const session = { user: { id: 'user-1', email: 'test@example.com', locale: 'en', role: 'user' } }

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(session as never)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown[]) => ops)
})

describe('editPlayedGame', () => {
  it('updates the played game and its scores in a transaction', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1',
      leagueId: 'lg1',
      submittedById: 'user-1',
      status: 'approved',
      league: { ownerId: 'user-1' },
    } as never)

    const result = await editPlayedGame('pg1', 'lg1', {
      playedAt: new Date('2026-04-21T20:00:00Z'),
      notes: 'edited',
      scores: [{ playerId: 'p1', score: 10 }, { playerId: 'p2', score: 5 }],
    })

    expect(prisma.$transaction).toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })

  it('rejects if the user does not own the league', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1',
      leagueId: 'lg1',
      league: { ownerId: 'other-user' },
    } as never)

    const result = await editPlayedGame('pg1', 'lg1', {
      playedAt: new Date(),
      notes: '',
      scores: [],
    })

    expect(result).toEqual({ success: false, error: 'notFound' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects if the session does not exist', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue(null)

    const result = await editPlayedGame('missing', 'lg1', {
      playedAt: new Date(),
      notes: '',
      scores: [],
    })

    expect(result).toEqual({ success: false, error: 'notFound' })
  })
})

describe('deletePlayedGame', () => {
  it('hard-deletes the played game', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1',
      leagueId: 'lg1',
      submittedById: 'user-1',
      league: { ownerId: 'user-1' },
    } as never)
    vi.mocked(prisma.playedGame.delete).mockResolvedValue({ id: 'pg1' } as never)

    const result = await deletePlayedGame('pg1', 'lg1')

    expect(prisma.playedGame.delete).toHaveBeenCalledWith({ where: { id: 'pg1' } })
    expect(result).toEqual({ success: true })
  })

  it('rejects if the user does not own the league', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue({
      id: 'pg1',
      leagueId: 'lg1',
      league: { ownerId: 'other-user' },
    } as never)

    const result = await deletePlayedGame('pg1', 'lg1')

    expect(result).toEqual({ success: false, error: 'notFound' })
    expect(prisma.playedGame.delete).not.toHaveBeenCalled()
  })

  it('rejects if the session does not exist', async () => {
    vi.mocked(prisma.playedGame.findUnique).mockResolvedValue(null)

    const result = await deletePlayedGame('missing', 'lg1')

    expect(result).toEqual({ success: false, error: 'notFound' })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/test/leagues-session-actions.test.ts
```

Expected: FAIL — `editPlayedGame` and `deletePlayedGame` are not exported from actions.ts.

- [ ] **Step 3: Add editPlayedGame and deletePlayedGame to actions.ts**

Add these two exports at the end of `src/app/app/leagues/[id]/actions.ts`:

```ts
type EditPlayedGameInput = {
  playedAt: Date
  notes: string
  winningMission?: string
  scores: { playerId: string; score: number }[]
}

export async function editPlayedGame(
  playedGameId: string,
  leagueId: string,
  input: EditPlayedGameInput,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId, leagueId },
    include: { league: { select: { ownerId: true } } },
  })
  if (!pg || pg.league.ownerId !== session.user.id) return { success: false, error: 'notFound' }

  await prisma.$transaction([
    prisma.scoreEntry.deleteMany({ where: { playedGameId } }),
    prisma.playedGame.update({
      where: { id: playedGameId },
      data: {
        playedAt: input.playedAt,
        notes: input.notes.trim() || null,
        winningMission: input.winningMission?.trim() || null,
      },
    }),
    prisma.scoreEntry.createMany({
      data: input.scores.map(s => ({ playedGameId, playerId: s.playerId, score: s.score })),
    }),
  ])

  await redis.del(`cache:dashboard:${session.user.id}`)
  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true }
}

export async function deletePlayedGame(
  playedGameId: string,
  leagueId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session) redirect('/en/auth/login')

  const pg = await prisma.playedGame.findUnique({
    where: { id: playedGameId, leagueId },
    include: { league: { select: { ownerId: true } } },
  })
  if (!pg || pg.league.ownerId !== session.user.id) return { success: false, error: 'notFound' }

  await prisma.playedGame.delete({ where: { id: playedGameId } })
  await redis.del(`cache:dashboard:${session.user.id}`)
  revalidatePath(`/app/leagues/${leagueId}`)
  return { success: true }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/test/leagues-session-actions.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/leagues/[id]/actions.ts src/test/leagues-session-actions.test.ts
git commit -m "feat(actions): add editPlayedGame and deletePlayedGame server actions"
```

---

### Task 5: Log form — datetime-local, two-phase participant selection, and edit mode

**Files:**
- Modify: `src/app/app/leagues/[id]/log/page.tsx`

This is the biggest change. The page gains:
1. `type="datetime-local"` instead of `type="date"`, defaulting to current time rounded to 5 minutes.
2. `step` state (`'participants' | 'scores'`).
3. Phase 1: toggle buttons for each league member, counter, min/max hint, disabled Continue when count is out of range.
4. Phase 2: scores/winner scoped only to selected participants.
5. Edit mode: when `?edit=<sessionId>` is in the URL, pre-populate all state from the session GET API and call `editPlayedGame` on submit instead of `logPlayedGame`.

- [ ] **Step 1: Rewrite `src/app/app/leagues/[id]/log/page.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { logPlayedGame, editPlayedGame } from '../actions'
import type { WinType } from '@/app/app/games/new/wizard-types'

type Member = { id: string; player: { id: string; name: string } }

const SCORE_BASED_TYPES: WinType[] = ['points-all', 'points-winner', 'time', 'ranking']

function defaultDatetime(): string {
  const ms = 5 * 60 * 1000
  const now = new Date(Math.round(Date.now() / ms) * ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export default function LogGamePage() {
  const t = useTranslations('app.playedGames')
  const tToasts = useTranslations('app.toasts')
  const tErrors = useTranslations('app.errors')
  const router = useRouter()
  const { id: leagueId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [members, setMembers] = useState<Member[]>([])
  const [winType, setWinType] = useState<WinType>('points-all')
  const [missions, setMissions] = useState<string[]>([])
  const [scoreFields, setScoreFields] = useState<string[]>([])
  const [minPlayers, setMinPlayers] = useState<number | null>(null)
  const [maxPlayers, setMaxPlayers] = useState<number | null>(null)
  const [step, setStep] = useState<'participants' | 'scores'>('participants')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [playedAt, setPlayedAt] = useState(defaultDatetime())
  const [notes, setNotes] = useState('')
  const [scores, setScores] = useState<Record<string, string[]>>({})
  const [winnerId, setWinnerId] = useState<string>('')
  const [winningMission, setWinningMission] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Fetch members + template config
  useEffect(() => {
    fetch(`/api/app/leagues/${leagueId}/members`)
      .then(r => r.json())
      .then((data: {
        members: Member[]
        winType: WinType
        missions: string[]
        scoreFields: string[]
        minPlayers: number | null
        maxPlayers: number | null
      }) => {
        setMembers(data.members)
        setWinType(data.winType)
        setMissions(data.missions ?? [])
        const fields = data.scoreFields ?? []
        setScoreFields(fields)
        setMinPlayers(data.minPlayers ?? null)
        setMaxPlayers(data.maxPlayers ?? null)
        const fieldCount = fields.length > 0 ? fields.length : 1
        const initial: Record<string, string[]> = {}
        data.members.forEach(m => { initial[m.player.id] = Array(fieldCount).fill('') })
        setScores(initial)
      })
      .catch(() => {})
  }, [leagueId])

  // If in edit mode, fetch existing session data and pre-populate
  useEffect(() => {
    if (!editId) return
    fetch(`/api/app/leagues/${leagueId}/sessions/${editId}`)
      .then(r => r.json())
      .then((data: {
        playedAt: string
        notes: string
        winningMission: string
        participantIds: string[]
        scores: { playerId: string; score: number }[]
        winnerId: string
      }) => {
        if (!data) return
        setPlayedAt(data.playedAt)
        setNotes(data.notes)
        setWinningMission(data.winningMission)
        setSelectedIds(new Set(data.participantIds))
        setWinnerId(data.winnerId)
        // Restore scores: put total in first field
        const scoreMap: Record<string, string[]> = {}
        data.scores.forEach(s => {
          scoreMap[s.playerId] = [String(s.score)]
        })
        setScores(prev => {
          // Merge: keep the field count from template but override values
          const merged: Record<string, string[]> = { ...prev }
          Object.entries(scoreMap).forEach(([pid, vals]) => {
            if (merged[pid]) {
              merged[pid] = merged[pid].map((_, i) => (i === 0 ? vals[0] : ''))
            } else {
              merged[pid] = vals
            }
          })
          return merged
        })
      })
      .catch(() => {})
  }, [editId, leagueId])

  const isScoreBased = SCORE_BASED_TYPES.includes(winType)
  const isMissionBased = winType === 'secret-mission'
  const selectedCount = selectedIds.size
  const participants = members.filter(m => selectedIds.has(m.player.id))

  const playerCountError = (() => {
    if (minPlayers !== null && selectedCount < minPlayers) return t('minPlayersNote', { min: minPlayers })
    if (maxPlayers !== null && selectedCount > maxPlayers) return t('maxPlayersNote', { max: maxPlayers })
    return null
  })()

  function toggleParticipant(playerId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  async function handleSubmit() {
    let scoreEntries: { playerId: string; score: number }[]

    if (isScoreBased) {
      scoreEntries = participants.map(m => ({
        playerId: m.player.id,
        score: (scores[m.player.id] ?? []).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0),
      }))
    } else {
      if (!winnerId) { toast.error(tErrors('required')); return }
      if (isMissionBased && !winningMission) { toast.error(tErrors('required')); return }
      scoreEntries = participants.map(m => ({
        playerId: m.player.id,
        score: m.player.id === winnerId ? 1 : 0,
      }))
    }

    setLoading(true)

    if (editId) {
      const result = await editPlayedGame(editId, leagueId, {
        playedAt: new Date(playedAt),
        notes,
        winningMission: isMissionBased ? winningMission : undefined,
        scores: scoreEntries,
      })
      setLoading(false)
      if (!result.success) { toast.error(tErrors(result.error as never)); return }
      toast.success(tToasts('sessionUpdated'))
    } else {
      const result = await logPlayedGame(leagueId, {
        playedAt: new Date(playedAt),
        notes,
        winningMission: isMissionBased ? winningMission : undefined,
        scores: scoreEntries,
      })
      setLoading(false)
      if (!result.success) { toast.error(tErrors(result.error as never)); return }
      toast.success(tToasts('gameSaved'))
    }

    router.push(`/app/leagues/${leagueId}`)
  }

  // --- Phase 1: Participant selection ---
  if (step === 'participants') {
    return (
      <div className="max-w-lg mx-auto py-8 px-2">
        <h1 className="font-headline font-black text-2xl mb-6" style={{ color: '#1c1810' }}>
          {editId ? t('edit') : t('log')}
        </h1>

        <div className="space-y-4 p-6 rounded-2xl mb-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-headline font-semibold text-xs" style={{ color: '#4a3f2f' }}>
                {t('selectParticipants')}
              </label>
              <span className="font-headline font-bold text-xs" style={{ color: '#9a8878' }}>
                {t('playersSelected', { count: selectedCount })}
                {(minPlayers !== null || maxPlayers !== null) && (
                  <span className="ml-2" style={{ color: '#c4b79a' }}>
                    ({t('playerHint', { min: minPlayers ?? '?', max: maxPlayers ?? '?' })})
                  </span>
                )}
              </span>
            </div>
            <ul className="space-y-2">
              {members.map(m => {
                const selected = selectedIds.has(m.player.id)
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggleParticipant(m.player.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                      style={{
                        borderColor: selected ? '#f5a623' : '#e8e1d8',
                        background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                        color: '#1c1810',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#f5a623' : '#c4b79a', background: selected ? '#f5a623' : 'transparent' }}
                      >
                        {selected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {m.player.name}
                    </button>
                  </li>
                )
              })}
            </ul>
            {playerCountError && (
              <p className="mt-3 text-xs font-body" style={{ color: '#c47f00' }}>{playerCountError}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => setStep('scores')}
          disabled={selectedCount === 0 || !!playerCountError}
          className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-40"
          style={{ background: '#f5a623', color: '#1c1408' }}
        >
          {t('continue')}
        </button>
      </div>
    )
  }

  // --- Phase 2: Scores / winner ---
  return (
    <div className="max-w-lg mx-auto py-8 px-2">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setStep('participants')}
          className="font-headline font-semibold text-sm"
          style={{ color: '#f5a623' }}
        >
          {t('back')}
        </button>
        <h1 className="font-headline font-black text-2xl" style={{ color: '#1c1810' }}>
          {editId ? t('edit') : t('log')}
        </h1>
      </div>

      <div className="space-y-4 p-6 rounded-2xl mb-6" style={{ background: '#fffdf9', border: '1px solid #e8e1d8' }}>
        {/* Datetime */}
        <div>
          <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{t('playedAt')}</label>
          <input
            type="datetime-local"
            value={playedAt}
            onChange={e => setPlayedAt(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        </div>

        {/* Scores or Winner picker — scoped to selected participants */}
        {isScoreBased ? (
          <div>
            <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('scores')}</label>
            <ul className="space-y-3">
              {participants.map(m => (
                <li key={m.id} className="rounded-xl border p-3" style={{ borderColor: '#e8e1d8', background: '#fffdf9' }}>
                  <span className="block font-headline font-semibold text-sm mb-2" style={{ color: '#1c1810' }}>{m.player.name}</span>
                  {scoreFields.length > 0 ? (
                    <div className="space-y-1.5">
                      {scoreFields.map((field, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="flex-1 font-body text-xs" style={{ color: '#4a3f2f' }}>{field}</span>
                          <input
                            type="number"
                            value={scores[m.player.id]?.[i] ?? ''}
                            onChange={e => setScores(prev => {
                              const arr = [...(prev[m.player.id] ?? [])]
                              arr[i] = e.target.value
                              return { ...prev, [m.player.id]: arr }
                            })}
                            placeholder="0"
                            className="w-24 px-3 py-1.5 rounded-xl border font-headline font-bold text-sm text-right"
                            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
                            onFocus={e => (e.target.style.borderColor = '#f5a623')}
                            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="number"
                      value={scores[m.player.id]?.[0] ?? ''}
                      onChange={e => setScores(prev => ({ ...prev, [m.player.id]: [e.target.value] }))}
                      placeholder={t('scorePlaceholder')}
                      className="w-full px-3 py-2 rounded-xl border font-headline font-bold text-sm text-right"
                      style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
                      onFocus={e => (e.target.style.borderColor = '#f5a623')}
                      onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winner')}</label>
            <ul className="space-y-2">
              {participants.map(m => {
                const selected = winnerId === m.player.id
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setWinnerId(m.player.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                      style={{
                        borderColor: selected ? '#f5a623' : '#e8e1d8',
                        background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                        color: '#1c1810',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#f5a623' : '#c4b79a' }}
                      >
                        {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623' }} />}
                      </span>
                      {m.player.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Mission picker */}
        {isMissionBased && missions.length > 0 && (
          <div>
            <label className="block font-headline font-semibold text-xs mb-2" style={{ color: '#4a3f2f' }}>{t('winningMission')}</label>
            <ul className="space-y-2">
              {missions.map(mission => {
                const selected = winningMission === mission
                return (
                  <li key={mission}>
                    <button
                      type="button"
                      onClick={() => setWinningMission(mission)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-headline font-semibold text-sm text-left transition-colors"
                      style={{
                        borderColor: selected ? '#f5a623' : '#e8e1d8',
                        background: selected ? 'rgba(245,166,35,0.1)' : '#fffdf9',
                        color: '#1c1810',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#f5a623' : '#c4b79a' }}
                      >
                        {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#f5a623' }} />}
                      </span>
                      {mission}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block font-headline font-semibold text-xs mb-1.5" style={{ color: '#4a3f2f' }}>{t('notes')}</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border font-body text-sm resize-none"
            style={{ borderColor: '#e8e1d8', outline: 'none', background: '#fffdf9' }}
            onFocus={e => (e.target.style.borderColor = '#f5a623')}
            onBlur={e => (e.target.style.borderColor = '#e8e1d8')}
          />
        </div>

        {!editId && (
          <div className="px-4 py-3 rounded-xl font-headline font-bold text-sm" style={{ background: 'rgba(245,166,35,0.1)', color: '#c47f00' }}>
            {t('cost')}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl font-headline font-bold text-sm disabled:opacity-60"
        style={{ background: '#f5a623', color: '#1c1408' }}
      >
        {loading ? t('saving') : editId ? t('saveChanges') : t('submit')}
      </button>
    </div>
  )
}
```

**Note:** The `t('edit')` key — check if `app.playedGames.edit` exists; if not, add `"edit": "Edit session"` / `"edit": "Sessie bewerken"` to both locale files in Task 1.

- [ ] **Step 2: Add missing `edit` key to translations** (if not already added in Task 1)

In `messages/en/app.json` under `"playedGames"`:
```json
"edit": "Edit session"
```
In `messages/nl/app.json` under `"playedGames"`:
```json
"edit": "Sessie bewerken"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/leagues/[id]/log/page.tsx messages/en/app.json messages/nl/app.json
git commit -m "feat(log): two-phase participant selection, datetime-local, edit mode"
```

---

### Task 6: SessionActions client component (edit link + inline delete)

**Files:**
- Create: `src/app/app/leagues/[id]/SessionActions.tsx`

The league page is a server component, so it can't hold inline confirmation state for delete. This client island handles the Edit link and the inline delete confirmation per session.

- [ ] **Step 1: Create `src/app/app/leagues/[id]/SessionActions.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { deletePlayedGame } from './actions'

type Props = {
  playedGameId: string
  leagueId: string
}

export function SessionActions({ playedGameId, leagueId }: Props) {
  const t = useTranslations('app.leagues')
  const tErrors = useTranslations('app.errors')
  const tToasts = useTranslations('app.toasts')
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const result = await deletePlayedGame(playedGameId, leagueId)
    setDeleting(false)
    if (!result.success) {
      toast.error(tErrors(result.error as never))
      setConfirming(false)
      return
    }
    toast.success(tToasts('sessionDeleted'))
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="font-body text-xs flex-1" style={{ color: '#4a3f2f' }}>{t('deleteSessionConfirm')}</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-3 py-1 rounded-lg font-headline font-semibold text-xs"
          style={{ background: '#f0ebe3', color: '#4a3f2f' }}
        >
          {t('deleteSessionCancel')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1 rounded-lg font-headline font-semibold text-xs disabled:opacity-50"
          style={{ background: '#ef4444', color: '#fff' }}
        >
          {deleting ? t('deleting') : t('deleteSessionConfirmBtn')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <Link
        href={`/app/leagues/${leagueId}/log?edit=${playedGameId}`}
        className="p-1.5 rounded-lg"
        style={{ color: '#9a8878' }}
        title={t('edit')}
      >
        <Pencil size={14} />
      </Link>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="p-1.5 rounded-lg"
        style={{ color: '#9a8878' }}
        title={t('deleteSessionConfirmBtn')}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add missing `edit` key to leagues namespace in translations**

In `messages/en/app.json` under `"leagues"` add:
```json
"edit": "Edit"
```
In `messages/nl/app.json` under `"leagues"` add:
```json
"edit": "Bewerken"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/leagues/[id]/SessionActions.tsx messages/en/app.json messages/nl/app.json
git commit -m "feat(ui): add SessionActions component with inline delete confirmation"
```

---

### Task 7: League page — win ratio per member, edit/delete per session

**Files:**
- Modify: `src/app/app/leagues/[id]/page.tsx`

Win ratio is computed server-side from the played games data already fetched. Members are sorted by win ratio descending. Each played game session card gets a `SessionActions` island.

- [ ] **Step 1: Extend the Prisma query to include score player IDs**

The current `scores` select in `playedGames` includes `{ include: { player: { select: { name: true } } } }`. Add `id: true` so we can match by player ID for win ratio calculation. Also include `submittedById` on PlayedGame so win ratio includes approved games only (which is already filtered by `status: 'approved'`).

Change the `playedGames` include block in the Prisma query from:
```ts
scores: {
  include: { player: { select: { name: true } } },
  orderBy: { score: 'desc' },
},
```
to:
```ts
scores: {
  select: { id: true, playerId: true, score: true, player: { select: { name: true } } },
  orderBy: { score: 'desc' },
},
```

- [ ] **Step 2: Compute win ratio per member after the Prisma query**

After the `if (!league || ...)` guard, add:

```ts
// Compute win ratio per member from approved played games
const membersWithStats = league.members.map(m => {
  const participated = league.playedGames.filter(pg =>
    pg.scores.some(s => s.playerId === m.player.id)
  )
  const wins = participated.filter(pg => pg.scores[0]?.playerId === m.player.id).length
  const gamesPlayed = participated.length
  const winRatio = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : null
  return { ...m, wins, gamesPlayed, winRatio }
})
const sortedMembers = [...membersWithStats].sort((a, b) => (b.winRatio ?? -1) - (a.winRatio ?? -1))
```

- [ ] **Step 3: Update the Members section to show win ratio badge and use sortedMembers**

Replace the members section JSX from:
```tsx
{league.members.map(m => (
  <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: '#f0ebe3' }}>
    <Avatar seed={m.player.avatarSeed} name={m.player.name} size={22} />
    <span className="font-headline font-semibold text-xs" style={{ color: '#1c1810' }}>{m.player.name}</span>
  </div>
))}
```
to:
```tsx
{sortedMembers.map(m => (
  <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: '#f0ebe3' }}>
    <Avatar seed={m.player.avatarSeed} name={m.player.name} size={22} />
    <span className="font-headline font-semibold text-xs" style={{ color: '#1c1810' }}>{m.player.name}</span>
    {m.winRatio !== null && (
      <span className="font-headline font-bold text-xs" style={{ color: '#9a8878' }}>
        {t('winsStats', { wins: m.wins, games: m.gamesPlayed, ratio: m.winRatio })}
      </span>
    )}
  </div>
))}
```

- [ ] **Step 4: Add SessionActions to each played game card and import the component**

Add `import { SessionActions } from './SessionActions'` at the top of the file.

In the played games list, update each `<li>` to include `SessionActions`. Change the header row of each session card from:
```tsx
<div className="flex items-center gap-2 mb-2">
  <span className="font-headline font-semibold text-xs" style={{ color: '#9a8878' }}>
    {new Date(pg.playedAt).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' })}
  </span>
  {pg.shareToken && <ShareButton token={pg.shareToken} />}
</div>
```
to:
```tsx
<div className="flex items-center gap-2 mb-2">
  <span className="font-headline font-semibold text-xs flex-1" style={{ color: '#9a8878' }}>
    {new Date(pg.playedAt).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' })}
    {new Date(pg.playedAt).getHours() !== 0 || new Date(pg.playedAt).getMinutes() !== 0
      ? ` ${String(new Date(pg.playedAt).getHours()).padStart(2, '0')}:${String(new Date(pg.playedAt).getMinutes()).padStart(2, '0')}`
      : null}
  </span>
  {pg.shareToken && <ShareButton token={pg.shareToken} />}
  <SessionActions playedGameId={pg.id} leagueId={id} />
</div>
```

- [ ] **Step 5: Verify the full updated file compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/leagues/[id]/page.tsx
git commit -m "feat(league): win ratio per member, edit/delete buttons per session"
```

---

### Task 8: Dashboard — add win ratio to leaderboard

**Files:**
- Modify: `src/app/app/dashboard/page.tsx`

The `DashboardStats` type gains `winRatio` on each leaderboard entry. The leaderboard stays sorted by wins (keeps existing behavior); win ratio is shown alongside the win count.

- [ ] **Step 1: Update the `DashboardStats` type**

Change:
```ts
leaderboard: { name: string; avatarSeed: string; wins: number }[]
```
to:
```ts
leaderboard: { name: string; avatarSeed: string; wins: number; gamesPlayed: number; winRatio: number }[]
```

- [ ] **Step 2: Update `loadStats` to track games played per player and compute win ratio**

Replace the existing `winCounts` block with:

```ts
const playerStats: Record<string, { name: string; avatarSeed: string; wins: number; gamesPlayed: number }> = {}
for (const pg of playedGames) {
  for (const s of pg.scores) {
    const key = s.player.name
    if (!playerStats[key]) playerStats[key] = { name: s.player.name, avatarSeed: s.player.avatarSeed, wins: 0, gamesPlayed: 0 }
    playerStats[key].gamesPlayed++
  }
  const winner = pg.scores[0]
  if (winner) playerStats[winner.player.name].wins++
}
const leaderboard = Object.values(playerStats)
  .map(p => ({ ...p, winRatio: p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0 }))
  .sort((a, b) => b.wins - a.wins)
  .slice(0, 5)
```

- [ ] **Step 3: Update the stats object construction**

The `stats` object assignment already uses `leaderboard` by reference, so just ensure the line is unchanged:
```ts
const stats: DashboardStats = { totalGames, totalPlayers, topGame, leaderboard, recentGames }
```

- [ ] **Step 4: Update the leaderboard JSX to display win ratio**

Change the leaderboard list item from:
```tsx
<span className="font-headline font-bold text-xs" style={{ color: '#9a8878' }}>{t('wins', { count: p.wins })}</span>
```
to:
```tsx
<div className="flex flex-col items-end gap-0.5">
  <span className="font-headline font-bold text-xs" style={{ color: '#9a8878' }}>{t('wins', { count: p.wins })}</span>
  <span className="font-headline text-xs" style={{ color: '#c4b79a' }}>{t('winRatio', { ratio: p.winRatio })}</span>
</div>
```

- [ ] **Step 5: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/dashboard/page.tsx
git commit -m "feat(dashboard): add win ratio column to leaderboard"
```

---

### Task 9: Run full test suite and push

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (including the new `leagues-session-actions.test.ts`).

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

---

## Self-Review against Spec

| Spec requirement | Task |
|---|---|
| `GET /api/app/leagues/[id]/members` returns `minPlayers` + `maxPlayers` | Task 2 |
| Log form two-phase: participant picker → scores/winner | Task 5 |
| None selected by default | Task 5 — `selectedIds` starts as empty `Set` |
| Counter + min/max hint | Task 5 — `selectedCount`, `playerCountError` |
| Continue disabled when count out of range | Task 5 — `disabled={selectedCount === 0 \|\| !!playerCountError}` |
| Phase 2 scoped to selected participants | Task 5 — `participants = members.filter(...)` |
| Back button without losing state | Task 5 — `setStep('participants')` keeps all state |
| `playedAt` becomes `datetime-local` | Task 5 — `type="datetime-local"`, `defaultDatetime()` |
| Win ratio on league page per member | Task 7 — `winsStats` badge, sorted by ratio |
| Win ratio on dashboard leaderboard | Task 8 |
| Edit session with pre-populated form | Tasks 3, 4, 5 |
| Re-approval logic for non-owner | Not needed — edit is owner-only so status always stays `approved` |
| Delete with inline confirmation | Task 6 — `SessionActions` with `confirming` state |
| Hard delete + cascade | Task 4 — `prisma.playedGame.delete`, cascade via schema `onDelete: Cascade` |
| Cache invalidation on delete | Task 4 — `redis.del(cache:dashboard:...)` |
| Dashboard cache gains new fields | Task 8 — `winRatio` in serialized object, existing 300s TTL + key unchanged |
