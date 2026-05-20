/**
 * The fixed sets a user can pick from for their account avatar. Both the picker
 * UI and the updateAvatar server action validate against these — single source
 * of truth for the allowed values.
 */
export const AVATAR_COLORS: string[] = [
  '#f5a623', '#e85d26', '#dc2626', '#db2777', '#7c3aed',
  '#2563eb', '#0891b2', '#16a34a', '#65a30d', '#ca8a04',
  '#78716c', '#0f172a',
]

export const AVATAR_ICONS: string[] = [
  '😀', '😎', '🤓', '🥳', '🦊', '🐱', '🐶', '🐼',
  '🦁', '🐸', '🐧', '🦉', '🐙', '🦄', '🐢', '🐝',
  '⭐', '⚡', '🔥', '🌈', '🍀', '🎈', '🚀', '🎸',
  '⚽', '🎲', '👑', '💎',
]
