import { encrypt, decrypt } from '@/lib/encryption'

// Cipher shape is `ivHex:tagHex:dataHex` (three hex groups). A raw base32 TOTP
// secret never contains ':' so we can detect legacy plaintext and pass it
// through, allowing a zero-downtime migration (secrets re-encrypt on next setup).
function looksEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p) && p.length > 0)
}

export function encryptTotpSecret(plaintext: string): string {
  return encrypt(plaintext)
}

export function decryptTotpSecret(stored: string): string {
  return looksEncrypted(stored) ? decrypt(stored) : stored
}
