# Security Utilities

Comprehensive security enhancements for the Festive Rides booking system.

## Overview

This directory contains security utilities that protect the application from common threats including:
- Bot submissions
- Spam/abuse
- DDoS attacks
- Data injection
- Information disclosure

## Components

### 1. Security Logger (`logger.ts`)

Structured logging system for security events.

**Features:**
- Standardized event types and severity levels
- Detailed event metadata tracking
- Integration-ready (Sentry, LogRocket, Datadog, etc.)

**Event Types:**
- `HONEYPOT_TRIGGERED` - Bot filled hidden field
- `RATE_LIMIT_EXCEEDED` - Too many requests from IP
- `FAST_SUBMISSION` - Form submitted too quickly
- `DUPLICATE_IP_BOOKING` - Multiple bookings from same IP
- `VALIDATION_FAILED` - Form validation errors
- `SUSPICIOUS_ACTIVITY` - Anomalous behavior detected
- `REQUEST_SIZE_EXCEEDED` - Payload too large
- `ENVIRONMENT_CHECK_FAILED` - Missing env variables

**Usage:**
```typescript
import { securityLogger } from '@/lib/security/logger';

securityLogger.logHoneypotTrigger(ip, userAgent, details);
securityLogger.logFastSubmission(ip, timeMs, userAgent);
```

### 2. Environment Validation (`env-validation.ts`)

Validates required environment variables on startup.

**Features:**
- Checks all required env vars are present
- Provides default values for optional vars
- Prevents app startup if critical vars missing (production)
- Typed configuration exports

**Usage:**
```typescript
import { requireValidEnvironment, config } from '@/lib/security/env-validation';

// Run at app startup
requireValidEnvironment();

// Access configuration
const maxSize = config.maxRequestSizeBytes;
```

### 3. IP Tracking (`ip-tracking.ts`)

Prevents spam and abuse through IP-based tracking.

**Features:**
- Duplicate booking detection (configurable time window)
- In-memory rate limiting (complementary to Redis)
- IP-based booking history

**Usage:**
```typescript
import { checkDuplicateIpBooking, checkRateLimit } from '@/lib/security/ip-tracking';

// Check for duplicate bookings
const duplicateCheck = await checkDuplicateIpBooking(ipAddress);
if (duplicateCheck.isDuplicate) {
  // Reject request
}

// Check rate limit
const rateLimitCheck = checkRateLimit(ipAddress, path);
if (!rateLimitCheck.allowed) {
  // Return 429 Too Many Requests
}
```

### 4. Submission Timing (`submission-timing.ts`)

Detects bot submissions through timing analysis.

**Features:**
- Validates form submission speed (min 3 seconds)
- Detects timestamp manipulation
- Prevents stale form submissions (max 24 hours)

**Usage:**
```typescript
import { validateSubmissionTiming } from '@/lib/security/submission-timing';

const timingCheck = validateSubmissionTiming(formLoadTime, ip, userAgent);
if (!timingCheck.isValid) {
  // Reject as potential bot
}
```

**Client-side integration:**
```typescript
// Store when form loads
const formLoadTime = Date.now();

// Send with form submission
fetch('/api/bookings', {
  method: 'POST',
  body: JSON.stringify({
    ...formData,
    formLoadTime
  })
});
```

### 5. Request Validation (`request-validation.ts`)

Validates and sanitizes incoming requests.

**Features:**
- IP address extraction (proxy-aware)
- Request size validation
- Honeypot field checking
- Security header management
- Rate limit header injection

**Usage:**
```typescript
import {
  getClientIp,
  validateRequestSize,
  validateHoneypot,
  addSecurityHeaders
} from '@/lib/security/request-validation';

const ip = getClientIp(request);
const sizeCheck = await validateRequestSize(request);
const honeypotCheck = validateHoneypot(body.honeypot, ip, userAgent);
```

## Integration Guide

### API Route Security Checklist

Every API route should implement these security checks:

```typescript
export async function POST(request: NextRequest) {
  // 1. Extract request metadata
  const { ip, userAgent, path } = extractRequestMetadata(request);

  // 2. Validate request size
  const sizeValidation = await validateRequestSize(request);
  if (!sizeValidation.isValid) {
    return addSecurityHeaders(sizeValidation.error!);
  }

  // 3. Check rate limiting
  const rateLimitCheck = checkRateLimit(ip, path);
  if (!rateLimitCheck.allowed) {
    const response = NextResponse.json({ error: rateLimitCheck.message }, { status: 429 });
    addRateLimitHeaders(response, rateLimitCheck.limit, rateLimitCheck.remaining, rateLimitCheck.resetTime);
    return addSecurityHeaders(response);
  }

  // 4. Parse body
  const body = await request.json();

  // 5. Check honeypot
  const honeypotCheck = validateHoneypot(body.honeypot, ip, userAgent);
  if (!honeypotCheck.isValid) {
    return addSecurityHeaders(honeypotCheck.error!);
  }

  // 6. Validate submission timing
  if (body.formLoadTime) {
    const timingCheck = validateSubmissionTiming(body.formLoadTime, ip, userAgent);
    if (!timingCheck.isValid) {
      return addSecurityHeaders(
        NextResponse.json({ error: timingCheck.message }, { status: 400 })
      );
    }
  }

  // 7. Check for duplicate submissions (if applicable)
  const duplicateCheck = await checkDuplicateIpBooking(ip);
  if (duplicateCheck.isDuplicate) {
    return addSecurityHeaders(
      NextResponse.json({ error: duplicateCheck.message }, { status: 429 })
    );
  }

  // 8. Proceed with business logic
  // ... your code here ...

  // 9. Add security headers to response
  return addSecurityHeaders(response);
}
```

### Client-side Integration

Add to your booking form:

```tsx
// Add hidden honeypot field (CSS should hide it)
<input
  type="text"
  name="honeypot"
  value={honeypot}
  onChange={(e) => setHoneypot(e.target.value)}
  tabIndex={-1}
  autoComplete="off"
  className="absolute opacity-0 pointer-events-none"
  aria-hidden="true"
/>

// Track form load time
const [formLoadTime] = useState(() => Date.now());

// Include in submission
const submitData = {
  ...formData,
  honeypot,
  formLoadTime
};
```

### Database Schema Requirements

Add these columns to the `bookings` table:

```sql
ALTER TABLE bookings ADD COLUMN ip_address TEXT;
ALTER TABLE bookings ADD COLUMN user_agent TEXT;
CREATE INDEX idx_bookings_ip_created ON bookings(ip_address, created_at);
```

## Configuration

All security settings can be configured via environment variables:

```env
# Maximum request body size (default: 1MB)
MAX_REQUEST_SIZE_BYTES=1048576

# Rate limiting (default: 10 requests per 15 min)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10

# Duplicate booking prevention (default: 24 hours)
DUPLICATE_BOOKING_WINDOW_HOURS=24

# Bot detection (default: 3 seconds minimum)
MIN_FORM_SUBMISSION_TIME_MS=3000
```

## Security Event Monitoring

In production, integrate with a logging service:

```typescript
// In logger.ts, update the log method:
async log(event: SecurityEvent) {
  // Send to Sentry
  Sentry.captureEvent({
    message: event.message,
    level: this.getSentryLevel(event.severity),
    extra: event
  });

  // Or LogRocket
  LogRocket.track('Security Event', event);

  // Or Datadog
  datadogLogs.logger.warn(event.message, event);
}
```

## Testing

Test security features with curl:

```bash
# Test rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/bookings \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
done

# Test honeypot
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"honeypot": "bot-filled-this", ...}'

# Test fast submission
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"formLoadTime": '$(date +%s%3N)', ...}'

# Test large payload
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d "$(python -c 'print("{\"data\": \"" + "x"*2000000 + "\"}")')"
```

## Maintenance

### Regular Tasks

1. **Monitor Security Logs**: Review security event logs weekly
2. **Update Thresholds**: Adjust rate limits based on legitimate traffic
3. **Clean Rate Limit Store**: Runs automatically every 5 minutes
4. **Review IP Blocks**: Check for false positives in duplicate detection

### Upgrading

When adding new security features:
1. Add new event type to `SecurityEventType` enum
2. Add logger method in `SecurityLogger` class
3. Update API routes to use new checks
4. Document in this README
5. Add tests

## Best Practices

1. **Always log security events** - Even if you don't block the request
2. **Use security headers** - Every response should include security headers
3. **Fail open when possible** - If a check fails due to error, allow the request
4. **Test in development** - Verify all checks work before deploying
5. **Monitor false positives** - Track blocked legitimate users
6. **Document rate limit headers** - Help API consumers understand limits
7. **Regular security audits** - Review and update security measures quarterly

## Troubleshooting

### Rate Limiting Not Working
- Check that IP extraction is working correctly
- Verify rate limit store is not being cleared prematurely
- Check if request is bypassing middleware

### Honeypot Triggering on Legitimate Users
- Ensure CSS properly hides the field
- Check autocomplete is disabled
- Verify no browser extensions are filling it

### Timing Validation False Positives
- Check server/client clock synchronization
- Verify formLoadTime is being sent correctly
- Consider increasing `MIN_FORM_SUBMISSION_TIME_MS`

### Environment Validation Failing
- Check `.env.local` file exists and is loaded
- Verify all required variables are set
- Check for typos in variable names

## Support

For issues or questions about security features, check:
1. Application logs for security events
2. This README for configuration options
3. Source code comments for detailed behavior
4. Create an issue if you discover a vulnerability
