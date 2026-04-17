import { TOTP, Secret } from 'otpauth'
import crypto from 'crypto'

export function generateTOTPSecret(email: string): { secret: string; uri: string } {
  const totp = new TOTP({
    issuer: 'Dice Vault',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  })
  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  }
}

export function verifyTOTPCode(secretBase32: string, token: string): boolean {
  const totp = new TOTP({
    issuer: 'Dice Vault',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  })
  const delta = totp.validate({ token, window: 1 })
  return delta !== null
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString('hex')
  )
}
