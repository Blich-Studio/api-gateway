import { createHash } from 'node:crypto'

/**
 * Utility functions for cryptographic operations
 */

/**
 * Hashes a token using SHA-256
 * @param token - The token to hash
 * @returns Hexadecimal representation of the hash
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Extracts a prefix from a token for efficient database lookups
 * @param token - The token to extract prefix from
 * @param length - Length of the prefix
 * @returns Token prefix
 */
export function getTokenPrefix(token: string, length: number): string {
  return token.substring(0, length)
}

/**
 * Generates a random delay to prevent timing attacks
 * @param minMs - Minimum delay in milliseconds
 * @param maxMs - Maximum delay in milliseconds
 * @returns Promise that resolves after the delay
 */
export async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise(resolve => {
    setTimeout(resolve, delay)
  })
}
