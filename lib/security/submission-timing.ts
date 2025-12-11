import { securityLogger } from './logger';
import { config } from './env-validation';

/**
 * Submission timing validation to detect bot submissions
 * Bots typically submit forms much faster than humans can read and fill them
 */

export interface TimingCheckResult {
  isValid: boolean;
  submissionTime: number;
  message?: string;
}

/**
 * Validate form submission timing
 * @param formLoadTime - Timestamp when the form was loaded (client-side)
 * @param ipAddress - IP address of the submitter
 * @param userAgent - User agent string
 * @returns Validation result
 */
export function validateSubmissionTiming(
  formLoadTime: number,
  ipAddress: string,
  userAgent: string
): TimingCheckResult {
  const now = Date.now();
  const submissionTime = now - formLoadTime;
  const minTime = config.minFormSubmissionTimeMs;

  // Check if submission was too fast (likely a bot)
  if (submissionTime < minTime) {
    // Log suspicious fast submission
    securityLogger.logFastSubmission(ipAddress, submissionTime, userAgent);

    return {
      isValid: false,
      submissionTime,
      message: `Form submitted too quickly. Please take time to review your information.`,
    };
  }

  // Check if timestamp is in the future (clock manipulation or invalid data)
  if (submissionTime < 0) {
    securityLogger.logSuspiciousActivity(
      ipAddress,
      'Form load time is in the future',
      { formLoadTime, currentTime: now, submissionTime },
      userAgent
    );

    return {
      isValid: false,
      submissionTime,
      message: 'Invalid form submission timestamp. Please refresh the page and try again.',
    };
  }

  // Check if form was loaded too long ago (> 24 hours)
  // This could indicate someone trying to bypass timing checks
  const maxFormAgeMs = 24 * 60 * 60 * 1000; // 24 hours
  if (submissionTime > maxFormAgeMs) {
    securityLogger.logSuspiciousActivity(
      ipAddress,
      'Form submission from stale page',
      { formLoadTime, currentTime: now, submissionTime, ageHours: submissionTime / (60 * 60 * 1000) },
      userAgent
    );

    return {
      isValid: false,
      submissionTime,
      message: 'Form session has expired. Please refresh the page and submit again.',
    };
  }

  return {
    isValid: true,
    submissionTime,
  };
}

/**
 * Generate a form load timestamp token
 * This can be used client-side to track when the form was loaded
 */
export function generateFormLoadToken(): number {
  return Date.now();
}

/**
 * Validate that a form load token is properly formatted
 */
export function isValidFormLoadToken(token: any): token is number {
  return typeof token === 'number' && !isNaN(token) && token > 0;
}
