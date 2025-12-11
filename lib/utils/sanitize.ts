/**
 * Input Sanitization Utility
 * Provides functions to sanitize user inputs to prevent XSS and injection attacks
 */

/**
 * Sanitize passenger name
 * - Removes all HTML tags
 * - Keeps only alphanumeric characters, spaces, hyphens, and apostrophes
 * - Trims whitespace
 * - Prevents XSS attacks
 */
export function sanitizePassengerName(input: string): string {
  // Remove any script tags and content (defense in depth)
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove all HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove any on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Keep only alphanumeric, spaces, hyphens, apostrophes, and periods
  // Supports international characters (accented letters)
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-'.\u00C0-\u00FF]/g, '');

  // Collapse multiple spaces into single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize special requirements
 * - Removes dangerous HTML but allows safe line breaks
 * - Removes script tags and event handlers
 * - Trims whitespace
 * - Prevents XSS attacks while allowing some text formatting
 */
export function sanitizeSpecialRequirements(input: string): string {
  // Remove script tags and content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove any on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove all other HTML tags except for safe ones
  // Remove: style, link, iframe, object, embed, meta, etc.
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/<link[^>]*>/gi, '');
  sanitized = sanitized.replace(/<iframe[^>]*>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');
  sanitized = sanitized.replace(/<meta[^>]*>/gi, '');
  sanitized = sanitized.replace(/<base[^>]*>/gi, '');

  // Remove potentially dangerous tags
  sanitized = sanitized.replace(/<(img|svg|canvas)[^>]*>/gi, '');

  // Remove href/src attributes that could contain javascript:
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '');

  // Collapse multiple spaces but preserve intentional line breaks
  sanitized = sanitized.replace(/ +/g, ' ');
  sanitized = sanitized.replace(/\n\s+/g, '\n');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize addresses (pickup and destination)
 * - Removes HTML tags
 * - Allows alphanumeric, spaces, common address characters (commas, periods, hyphens, numbers, parentheses)
 * - Removes suspicious characters
 * - Trims whitespace
 */
export function sanitizeAddress(input: string): string {
  // Remove script tags and content first
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove all HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove any on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Keep only alphanumeric, spaces, common address characters
  // Allows: letters, numbers, spaces, commas, periods, hyphens, parentheses, slashes, apostrophes, & symbol
  // Supports international characters (accented letters)
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s,.\-()/'&#\u00C0-\u00FF]/g, '');

  // Collapse multiple spaces into single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize cancellation reason
 * - Similar to special requirements
 * - Removes HTML tags and dangerous scripts
 * - Preserves line breaks for readability
 */
export function sanitizeCancellationReason(input: string): string {
  // Same as special requirements sanitization
  return sanitizeSpecialRequirements(input);
}

/**
 * Generic HTML sanitization that removes all HTML tags
 * Use this for text-only fields where no HTML is needed
 */
export function sanitizeHTML(input: string): string {
  // Remove all HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove any on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}
