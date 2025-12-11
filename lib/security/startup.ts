/**
 * Application startup security checks
 * Run this at application initialization to ensure all security requirements are met
 */

import { requireValidEnvironment } from './env-validation';

/**
 * Run all startup security checks
 * Should be called when the application starts
 */
export function runStartupSecurityChecks(): void {
  console.log('Running startup security checks...');

  // 1. Validate environment variables
  requireValidEnvironment();

  // 2. Log security configuration
  logSecurityConfiguration();

  console.log('All startup security checks passed');
}

/**
 * Log current security configuration (without sensitive data)
 */
function logSecurityConfiguration(): void {
  const config = {
    nodeEnv: process.env.NODE_ENV,
    maxRequestSize: process.env.MAX_REQUEST_SIZE_BYTES || 'default (1MB)',
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW_MS || 'default (15 min)',
    rateLimitMax: process.env.RATE_LIMIT_MAX_REQUESTS || 'default (10)',
    duplicateBookingWindow: process.env.DUPLICATE_BOOKING_WINDOW_HOURS || 'default (24h)',
    minSubmissionTime: process.env.MIN_FORM_SUBMISSION_TIME_MS || 'default (3s)',
  };

  console.log('Security Configuration:', config);
}

// Run checks immediately if this file is imported during server startup
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  // Only run in server context, not during build
  if (typeof window === 'undefined') {
    try {
      runStartupSecurityChecks();
    } catch (error) {
      console.error('Startup security checks failed:', error);
      // In production, this should prevent the app from starting
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}
