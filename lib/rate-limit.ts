import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// Check if Upstash is configured
const isUpstashConfigured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

// Create Redis client only if configured
const redis = isUpstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limiter configurations
export const rateLimiters = {
  // 3 requests per hour for booking creation
  bookings: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '1 h'),
        analytics: true,
        prefix: '@upstash/ratelimit:bookings',
      })
    : null,

  // 5 requests per hour for cancellations
  cancellations: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'),
        analytics: true,
        prefix: '@upstash/ratelimit:cancellations',
      })
    : null,

  // 60 requests per minute for availability checks
  availability: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '1 m'),
        analytics: true,
        prefix: '@upstash/ratelimit:availability',
      })
    : null,
};

/**
 * Get the client IP address from the request
 */
function getClientIP(request: NextRequest): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  // Use the first available IP
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a default identifier
  return 'unknown';
}

/**
 * Rate limit result interface
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Apply rate limiting to a request
 */
export async function rateLimit(
  request: NextRequest,
  limiterName: keyof typeof rateLimiters
): Promise<RateLimitResult> {
  const limiter = rateLimiters[limiterName];

  // If rate limiting is not configured (development mode), allow all requests
  if (!limiter || !isUpstashConfigured) {
    console.warn(
      `Rate limiting not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables to enable rate limiting.`
    );
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }

  // Get client IP
  const identifier = getClientIP(request);

  // Check rate limit
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  return {
    success,
    limit,
    remaining,
    reset,
  };
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  // Only add headers if rate limiting is configured
  if (result.limit > 0) {
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());
  }

  return response;
}

/**
 * Create a rate limit error response
 */
export function createRateLimitErrorResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

  const response = NextResponse.json(
    {
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter,
    },
    { status: 429 }
  );

  // Add rate limit headers
  addRateLimitHeaders(response, result);

  // Add Retry-After header (in seconds)
  response.headers.set('Retry-After', retryAfter.toString());

  return response;
}

/**
 * Middleware helper to apply rate limiting to an endpoint
 */
export async function withRateLimit(
  request: NextRequest,
  limiterName: keyof typeof rateLimiters,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(request, limiterName);

  // Check if rate limit exceeded
  if (!rateLimitResult.success) {
    return createRateLimitErrorResponse(rateLimitResult);
  }

  // Execute the handler
  const response = await handler();

  // Add rate limit headers to the response
  return addRateLimitHeaders(response, rateLimitResult);
}
