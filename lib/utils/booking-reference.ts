import { customAlphabet } from 'nanoid';

// Create custom alphabet (uppercase letters and numbers, excluding confusing characters like 0, O, I, 1)
const nanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);

/**
 * Generate a unique booking reference
 * Format: FR-ABC123 (FR prefix + 6 random characters)
 */
export function generateBookingReference(): string {
  return `FR-${nanoid()}`;
}

/**
 * Validate booking reference format
 */
export function isValidBookingReference(reference: string): boolean {
  const pattern = /^FR-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
  return pattern.test(reference);
}
