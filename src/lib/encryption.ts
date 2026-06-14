import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

function deriveKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 32 || secret === 'change_me_in_production') {
    throw new Error('NEXTAUTH_SECRET must be set to a strong value (>= 32 chars) before using encryption')
  }
  return createHash('sha256').update(secret).digest()
}

export function encrypt(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const key = deriveKey()
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
