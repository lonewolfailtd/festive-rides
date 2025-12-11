# Security Quick Start Guide

Quick reference for implementing security features in the Festive Rides booking system.

## For Backend Developers

### Adding Security to a New API Route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  extractRequestMetadata,
  validateRequestSize,
  validateHoneypot,
  addSecurityHeaders,
  addRateLimitHeaders,
} from '@/lib/security/request-validation';
import { checkRateLimit } from '@/lib/security/ip-tracking';
import { securityLogger } from '@/lib/security/logger';

export async function POST(request: NextRequest) {
  // 1. Extract metadata
  const { ip, userAgent, path } = extractRequestMetadata(request);

  // 2. Check request size
  const sizeCheck = await validateRequestSize(request);
  if (!sizeCheck.isValid) return addSecurityHeaders(sizeCheck.error!);

  // 3. Rate limit
  const rateLimit = checkRateLimit(ip, path);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: rateLimit.message },
      { status: 429 }
    );
    addRateLimitHeaders(response, rateLimit.limit, rateLimit.remaining, rateLimit.resetTime);
    return addSecurityHeaders(response);
  }

  // 4. Parse body
  const body = await request.json();

  // 5. Check honeypot
  const honeypot = validateHoneypot(body.honeypot, ip, userAgent);
  if (!honeypot.isValid) return addSecurityHeaders(honeypot.error!);

  // 6. Your business logic here
  // ...

  // 7. Return with security headers
  const response = NextResponse.json({ success: true });
  return addSecurityHeaders(response);
}
```

### Logging Security Events

```typescript
import { securityLogger } from '@/lib/security/logger';

// Log various events
securityLogger.logHoneypotTrigger(ip, userAgent, details);
securityLogger.logFastSubmission(ip, timeMs, userAgent);
securityLogger.logDuplicateIpBooking(ip, previousTime);
securityLogger.logValidationFailure(ip, path, errors, userAgent);
securityLogger.logSuspiciousActivity(ip, reason, details, userAgent);
```

### Environment Variables

Add to your `.env.local`:

```env
# Security Configuration
MAX_REQUEST_SIZE_BYTES=1048576
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10
DUPLICATE_BOOKING_WINDOW_HOURS=24
MIN_FORM_SUBMISSION_TIME_MS=3000
```

## For Frontend Developers

### Adding Security Fields to Forms

```tsx
'use client';

import { useState } from 'react';

export function BookingForm() {
  // Track when form loads
  const [formLoadTime] = useState(() => Date.now());

  // Honeypot field (always empty for real users)
  const [honeypot, setHoneypot] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = {
      // ... your form fields ...

      // Security fields
      honeypot,
      formLoadTime,
    };

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    // Handle response...
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Your form fields */}

      {/* Hidden honeypot field - DO NOT REMOVE */}
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

      <button type="submit">Submit</button>
    </form>
  );
}
```

### CSS for Honeypot Field

```css
/* Make sure honeypot is truly hidden */
input[name="honeypot"] {
  position: absolute !important;
  opacity: 0 !important;
  pointer-events: none !important;
  width: 0 !important;
  height: 0 !important;
  left: -9999px !important;
}
```

## For DevOps/Deployment

### Database Migration

Run this SQL on your Supabase database:

```bash
psql -h your-db-host -U postgres -d your-database -f lib/security/database-migration.sql
```

Or use Supabase dashboard SQL editor to run:
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_agent TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_ip_created ON bookings(ip_address, created_at);
```

### Environment Variables

Production environment needs:

**Required:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
RESEND_API_KEY=re_xxxxx
ADMIN_EMAIL=your@email.com
NEXT_PUBLIC_APP_URL=https://yoursite.com
```

**Optional (with defaults):**
```env
MAX_REQUEST_SIZE_BYTES=1048576
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10
DUPLICATE_BOOKING_WINDOW_HOURS=24
MIN_FORM_SUBMISSION_TIME_MS=3000
```

### Monitoring Security Logs

Check application logs for security events:

```bash
# Filter security events
grep "SECURITY" /var/log/app.log

# Watch for high severity events
tail -f /var/log/app.log | grep "SECURITY HIGH\|SECURITY CRITICAL"

# Count events by type
grep "SECURITY" /var/log/app.log | awk '{print $3}' | sort | uniq -c
```

## Testing

### Test Honeypot

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"honeypot": "bot-filled-this", ...}'
# Should return 400 Bad Request
```

### Test Fast Submission

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d "{\"formLoadTime\": $(date +%s%3N), ...}"
# Should return 400 if < 3 seconds
```

### Test Rate Limiting

```bash
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/bookings \
    -H "Content-Type: application/json" \
    -d '{...}'
done
# 11th request should return 429
```

### Test Request Size

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d "$(python -c 'print("{\"data\": \"" + "x"*2000000 + "\"}")')"
# Should return 413 Payload Too Large
```

## Common Issues

### "Environment validation failed"
**Solution:** Check `.env.local` has all required variables set

### "Rate limit exceeded"
**Solution:** Wait 15 minutes or clear rate limit:
```typescript
import { clearRateLimit } from '@/lib/security/ip-tracking';
clearRateLimit('127.0.0.1', '/api/bookings');
```

### Honeypot triggering on real users
**Solution:** Ensure CSS properly hides field and autocomplete is disabled

### Timing validation false positives
**Solution:** Increase `MIN_FORM_SUBMISSION_TIME_MS` in environment

## Security Checklist

Before deploying:

- [ ] All required environment variables set
- [ ] Database migration completed
- [ ] Honeypot field added to forms
- [ ] Form load time tracking implemented
- [ ] Security features tested
- [ ] Logging/monitoring configured
- [ ] Rate limits appropriate for traffic
- [ ] HTTPS enabled in production
- [ ] Security headers verified

## Support

- **Documentation**: `lib/security/README.md`
- **Examples**: `app/api/bookings/route.ts`
- **Issues**: Create GitHub issue
- **Security**: Email sammipetersen1720@yahoo.co.nz
