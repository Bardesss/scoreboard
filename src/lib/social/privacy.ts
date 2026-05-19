const VALID_MODES = new Set(['stats', 'full'])

export function canViewPublicProfile(profile: { publicProfileMode: string }): boolean {
  return VALID_MODES.has(profile.publicProfileMode)
}

export function shouldRenderGames(profile: { publicProfileMode: string }): boolean {
  return profile.publicProfileMode === 'full'
}

function indexToLetters(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

export function anonymizeName(
  viewer: 'public',
  subject: { allowAppearInOthers: boolean; name: string },
  opponentIndex: number,
): string {
  if (subject.allowAppearInOthers) return subject.name
  return `Speler ${indexToLetters(opponentIndex)}`
}
