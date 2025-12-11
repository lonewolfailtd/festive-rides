import { createServerClient } from '@/lib/supabase/server';
import { securityLogger } from './logger';
import { config } from './env-validation';

/**
 * IP-based duplicate booking detection
 * Tracks bookings by IP address to prevent spam/abuse
 */

export interface IpBookingCheck {
  isDuplicate: boolean;
  previousBooking?: {
    id: string;
    created_at: string;
    booking_reference: string;
  };
  message?: string;
}

/**
 * Check if an IP has made a booking within the configured time window
 */
export async function checkDuplicateIpBooking(
  ipAddress: string
): Promise<IpBookingCheck> {
  try {
    const supabase = createServerClient();

    // Calculate the time threshold
    const windowHours = config.duplicateBookingWindowHours;
    const thresholdTime = new Date();
    thresholdTime.setHours(thresholdTime.getHours() - windowHours);

    // Query for recent bookings from this IP
    const { data: recentBookings, error } = await (supabase as any)
      .from('bookings')
      .select('id, created_at, booking_reference, ip_address')
      .eq('ip_address', ipAddress)
      .eq('status', 'confirmed')
      .gte('created_at', thresholdTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking duplicate IP booking:', error);
      // If we can't check, allow the booking but log the error
      return { isDuplicate: false };
    }

    // If we found a recent booking from this IP
    if (recentBookings && recentBookings.length > 0) {
      const previousBooking = recentBookings[0];

      // Log the duplicate attempt
      securityLogger.logDuplicateIpBooking(ipAddress, previousBooking.created_at, {
        previousBookingRef: previousBooking.booking_reference,
        windowHours,
      });

      return {
        isDuplicate: true,
        previousBooking: {
          id: previousBooking.id,
          created_at: previousBooking.created_at,
          booking_reference: previousBooking.booking_reference,
        },
        message: `You have already made a booking within the last ${windowHours} hours. Please contact us if you need to make additional bookings.`,
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Unexpected error in duplicate IP check:', error);
    // If something goes wrong, allow the booking to proceed
    return { isDuplicate: false };
  }
}

/**
 * In-memory rate limiting store
 * In production, use Redis or a proper rate limiting service
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries from rate limit store
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

/**
 * Check if an IP has exceeded the rate limit
 */
export interface RateLimitCheck {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  message?: string;
}

export function checkRateLimit(ipAddress: string, path: string): RateLimitCheck {
  const now = Date.now();
  const key = `${ipAddress}:${path}`;
  const limit = config.rateLimitMaxRequests;
  const windowMs = config.rateLimitWindowMs;

  let entry = rateLimitStore.get(key);

  // If no entry exists or the window has expired, create a new one
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetTime: entry.resetTime,
    };
  }

  // Increment the counter
  entry.count++;

  // Check if limit exceeded
  if (entry.count > limit) {
    // Log rate limit violation
    securityLogger.logRateLimitExceeded(ipAddress, path, {
      count: entry.count,
      limit,
      resetTime: new Date(entry.resetTime).toISOString(),
    });

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTime: entry.resetTime,
      message: `Rate limit exceeded. Please try again later.`,
    };
  }

  return {
    allowed: true,
    limit,
    remaining: limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Clear rate limit for an IP (useful for testing or admin actions)
 */
export function clearRateLimit(ipAddress: string, path: string): void {
  const key = `${ipAddress}:${path}`;
  rateLimitStore.delete(key);
}
