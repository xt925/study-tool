import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/** scrypt 密码哈希，盐独立存放 */
export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashPassword(password, salt), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function genSalt(): string {
  return randomBytes(16).toString('hex')
}

export function genToken(): string {
  return randomBytes(32).toString('hex')
}
