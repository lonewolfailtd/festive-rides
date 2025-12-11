import { customAlphabet } from 'nanoid';

// Create custom alphabet for verification tokens (URL-safe)
const nanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 32);

/**
 * Generate a unique verification token
 * Format: 32 random URL-safe characters
 */
export function generateVerificationToken(): string {
  return nanoid();
}

/**
 * Generate token expiration timestamp (24 hours from now)
 */
export function generateTokenExpiration(): Date {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 24);
  return expiration;
}

/**
 * Check if a verification token has expired
 */
export function isTokenExpired(expiresAt: string | Date): boolean {
  const expirationDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return new Date() > expirationDate;
}

/**
 * Validate verification token format (32 character alphanumeric)
 */
export function isValidVerificationToken(token: string): boolean {
  const pattern = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz]{32}$/;
  return pattern.test(token);
}
