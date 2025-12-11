/**
 * Security Event Logger
 * Provides structured logging for security-related events
 */

export enum SecurityEventType {
  HONEYPOT_TRIGGERED = 'HONEYPOT_TRIGGERED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  FAST_SUBMISSION = 'FAST_SUBMISSION',
  DUPLICATE_IP_BOOKING = 'DUPLICATE_IP_BOOKING',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  REQUEST_SIZE_EXCEEDED = 'REQUEST_SIZE_EXCEEDED',
  ENVIRONMENT_CHECK_FAILED = 'ENVIRONMENT_CHECK_FAILED',
}

export enum SecurityEventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  details?: Record<string, any>;
  message: string;
}

class SecurityLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log a security event
   */
  log(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // In production, you would send this to a logging service (e.g., Sentry, LogRocket, Datadog)
    // For now, we'll use structured console logging
    const logLevel = this.getLogLevel(event.severity);
    const logMessage = this.formatLogMessage(fullEvent);

    console[logLevel](logMessage, {
      event: fullEvent,
      environment: process.env.NODE_ENV,
    });

    // TODO: In production, send to external logging service
    // Example: await sendToLoggingService(fullEvent);
  }

  /**
   * Log honeypot trigger
   */
  logHoneypotTrigger(ip: string, userAgent: string, details?: Record<string, any>): void {
    this.log({
      type: SecurityEventType.HONEYPOT_TRIGGERED,
      severity: SecurityEventSeverity.HIGH,
      ip,
      userAgent,
      details,
      message: `Honeypot field filled from IP ${ip}`,
    });
  }

  /**
   * Log rate limit violation
   */
  logRateLimitExceeded(ip: string, path: string, details?: Record<string, any>): void {
    this.log({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecurityEventSeverity.MEDIUM,
      ip,
      path,
      details,
      message: `Rate limit exceeded for IP ${ip} on path ${path}`,
    });
  }

  /**
   * Log fast form submission (potential bot)
   */
  logFastSubmission(ip: string, submissionTime: number, userAgent: string): void {
    this.log({
      type: SecurityEventType.FAST_SUBMISSION,
      severity: SecurityEventSeverity.HIGH,
      ip,
      userAgent,
      details: { submissionTimeMs: submissionTime },
      message: `Suspiciously fast submission (${submissionTime}ms) from IP ${ip}`,
    });
  }

  /**
   * Log duplicate IP booking attempt
   */
  logDuplicateIpBooking(ip: string, previousBookingTime: string, details?: Record<string, any>): void {
    this.log({
      type: SecurityEventType.DUPLICATE_IP_BOOKING,
      severity: SecurityEventSeverity.MEDIUM,
      ip,
      details: { previousBookingTime, ...details },
      message: `Duplicate booking attempt from IP ${ip} (previous booking at ${previousBookingTime})`,
    });
  }

  /**
   * Log validation failure
   */
  logValidationFailure(ip: string, path: string, errors: any, userAgent?: string): void {
    this.log({
      type: SecurityEventType.VALIDATION_FAILED,
      severity: SecurityEventSeverity.LOW,
      ip,
      path,
      userAgent,
      details: { validationErrors: errors },
      message: `Validation failed for request from IP ${ip}`,
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    ip: string,
    reason: string,
    details?: Record<string, any>,
    userAgent?: string
  ): void {
    this.log({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: SecurityEventSeverity.HIGH,
      ip,
      userAgent,
      details,
      message: `Suspicious activity detected from IP ${ip}: ${reason}`,
    });
  }

  /**
   * Log request size exceeded
   */
  logRequestSizeExceeded(ip: string, size: number, maxSize: number, path: string): void {
    this.log({
      type: SecurityEventType.REQUEST_SIZE_EXCEEDED,
      severity: SecurityEventSeverity.MEDIUM,
      ip,
      path,
      details: { requestSize: size, maxSize },
      message: `Request size (${size} bytes) exceeded maximum (${maxSize} bytes) from IP ${ip}`,
    });
  }

  /**
   * Log environment validation failure
   */
  logEnvironmentCheckFailed(missingVars: string[]): void {
    this.log({
      type: SecurityEventType.ENVIRONMENT_CHECK_FAILED,
      severity: SecurityEventSeverity.CRITICAL,
      details: { missingVariables: missingVars },
      message: `Environment validation failed: missing ${missingVars.join(', ')}`,
    });
  }

  /**
   * Get appropriate console log level based on severity
   */
  private getLogLevel(severity: SecurityEventSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case SecurityEventSeverity.CRITICAL:
      case SecurityEventSeverity.HIGH:
        return 'error';
      case SecurityEventSeverity.MEDIUM:
        return 'warn';
      case SecurityEventSeverity.LOW:
      default:
        return 'info';
    }
  }

  /**
   * Format log message for console output
   */
  private formatLogMessage(event: SecurityEvent): string {
    return `[SECURITY ${event.severity}] ${event.type}: ${event.message}`;
  }
}

// Export singleton instance
export const securityLogger = new SecurityLogger();
