import { createHash } from 'node:crypto'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex') // Hash the token using SHA-256
}
