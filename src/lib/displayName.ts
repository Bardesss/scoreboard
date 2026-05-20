/**
 * The name to show for a user, in precedence order:
 * displayName → username → email local-part → empty string.
 * Empty/missing values fall through. Used everywhere a user's name renders.
 */
export function resolveDisplayName(user: {
  displayName?: string | null
  username?: string | null
  email?: string | null
}): string {
  if (user.displayName) return user.displayName
  if (user.username) return user.username
  if (user.email) return user.email.split('@')[0]
  return ''
}
