export type TimeUnit = 'seconds' | 'minutes' | 'mmss' | null

export function formatTime(seconds: number, unit: TimeUnit): string {
  if (unit === 'minutes') return `${(seconds / 60).toFixed(1)} min`
  if (unit === 'mmss') {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${seconds}s`
}

export function parseTimeInput(
  input: string | { mm: string; ss: string },
  unit: TimeUnit,
): number | null {
  if (unit === 'mmss') {
    if (typeof input === 'string') return null
    const mm = parseInt(input.mm, 10)
    const ss = parseInt(input.ss, 10)
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null
    if (mm < 0 || ss < 0 || ss >= 60) return null
    return mm * 60 + ss
  }
  if (typeof input !== 'string') return null
  if (input.trim() === '') return null
  if (unit === 'minutes') {
    const minutes = parseFloat(input)
    if (!Number.isFinite(minutes) || minutes < 0) return null
    return Math.round(minutes * 60)
  }
  const secs = parseInt(input, 10)
  if (!Number.isFinite(secs) || secs < 0) return null
  return secs
}
