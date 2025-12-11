import { NextRequest, NextResponse } from 'next/server';
import { securityLogger } from './logger';
import { config } from './env-validation';

/**
 * Request validation utilities for security
 */

/**
 * Get client IP address from request
 * Handles various proxy headers
 */
export function getClientIp(request: NextRequest): string {
  // Check common proxy headers in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Fallback to a default if we can't determine IP
  return 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Validate request body size
 */
export async function validateRequestSize(
  request: NextRequest,
  maxSizeBytes: number = config.maxRequestSizeBytes
): Promise<{ isValid: boolean; size?: number; error?: NextResponse }> {
  try {
    // Get content-length header
    const contentLength = request.headers.get('content-length');

    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (size > maxSizeBytes) {
        const ip = getClientIp(request);
        const path = request.nextUrl.pathname;

        securityLogger.logRequestSizeExceeded(ip, size, maxSizeBytes, path);

        return {
          isValid: false,
          size,
          error: NextResponse.json(
            {
              error: 'Request body too large',
              maxSize: maxSizeBytes,
            },
            { status: 413 } // 413 Payload Too Large
          ),
        };
      }
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating request size:', error);
    return { isValid: true }; // Allow request if we can't validate
  }
}

/**
 * Validate honeypot field
 * The honeypot field should be empty (hidden from real users, filled by bots)
 */
export function validateHoneypot(
  honeypotValue: any,
  ip: string,
  userAgent: string
): { isValid: boolean; error?: NextResponse } {
  // If honeypot field is filled, it's likely a bot
  if (honeypotValue && honeypotValue !== '') {
    securityLogger.logHoneypotTrigger(ip, userAgent, {
      honeypotValue: typeof honeypotValue === 'string' ? honeypotValue.substring(0, 100) : honeypotValue,
    });

    return {
      isValid: false,
      error: NextResponse.json(
        {
          error: 'Validation failed',
        },
        { status: 400 }
      ),
    };
  }

  return { isValid: true };
}

/**
 * Sanitize and validate common request data
 */
export interface SanitizedRequestData {
  ip: string;
  userAgent: string;
  path: string;
  method: string;
}

export function extractRequestMetadata(request: NextRequest): SanitizedRequestData {
  return {
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    path: request.nextUrl.pathname,
    method: request.method,
  };
}

/**
 * Validate request method
 */
export function validateRequestMethod(
  request: NextRequest,
  allowedMethods: string[]
): { isValid: boolean; error?: NextResponse } {
  if (!allowedMethods.includes(request.method)) {
    return {
      isValid: false,
      error: NextResponse.json(
        {
          error: 'Method not allowed',
        },
        { status: 405 }
      ),
    };
  }

  return { isValid: true };
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // These are fallback headers in case middleware doesn't run
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

/**
 * Create rate limit headers for response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetTime: number
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(resetTime / 1000)));

  return response;
}
