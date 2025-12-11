# Rate Limiting Implementation

This document explains the rate limiting implementation for the Festive Rides booking system.

## Overview

Rate limiting has been implemented to prevent API abuse and spam on the following endpoints:

| Endpoint | Rate Limit | Description |
|----------|-----------|-------------|
| `/api/bookings` | 3 requests per hour per IP | Creates new bookings |
| `/api/bookings/cancel` | 5 requests per hour per IP | Cancels existing bookings |
| `/api/bookings/check-availability` | 60 requests per minute per IP | Checks available time slots |

## Setup Instructions

### 1. Install Dependencies

```bash
npm install @upstash/ratelimit @upstash/redis
```

### 2. Create Upstash Redis Database

1. Sign up for a free account at [Upstash](https://upstash.com)
2. Create a new Redis database
3. Copy the REST URL and REST Token from the database details page

### 3. Configure Environment Variables

Add the following variables to your `.env.local` file:

```env
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxXXxxx
```

## Development Mode

The rate limiting system gracefully handles missing Upstash configuration. If the environment variables are not set, the system will:

- Log a warning message to the console
- Allow all requests to pass through
- Not add rate limit headers to responses

This makes it easy to develop and test locally without setting up Upstash Redis.

## Production Setup

For production environments, **always configure Upstash Redis** to enable rate limiting protection.

## Rate Limit Headers

When rate limiting is enabled, all responses include the following headers:

- `X-RateLimit-Limit`: Maximum number of requests allowed in the time window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Timestamp (in milliseconds) when the rate limit resets

## Rate Limit Exceeded Response

When a client exceeds the rate limit, they receive a `429 Too Many Requests` response:

```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 3600
}
```

The response also includes:
- `Retry-After` header: Number of seconds until the client can retry
- All standard rate limit headers (X-RateLimit-*)

## Implementation Details

### Rate Limiter Configuration

The rate limiters use Upstash's sliding window algorithm for accurate rate limiting:

```typescript
// 3 requests per hour for bookings
bookings: new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: true,
  prefix: '@upstash/ratelimit:bookings',
})
```

### IP Address Detection

The system detects client IP addresses from the following headers (in order of priority):

1. `x-forwarded-for` (most common for proxied requests)
2. `x-real-ip` (nginx/reverse proxy)
3. `cf-connecting-ip` (Cloudflare)

If no IP can be determined, it falls back to `'unknown'`.

### Usage in API Routes

Rate limiting is applied using the `withRateLimit` helper:

```typescript
export async function POST(request: NextRequest) {
  return withRateLimit(request, 'bookings', async () => {
    // Your endpoint logic here
  });
}
```

## Customizing Rate Limits

To adjust rate limits, edit the `lib/rate-limit.ts` file:

```typescript
export const rateLimiters = {
  bookings: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'), // Change to 5 per hour
        analytics: true,
        prefix: '@upstash/ratelimit:bookings',
      })
    : null,
};
```

Available time windows:
- `'1 s'` - 1 second
- `'1 m'` - 1 minute
- `'1 h'` - 1 hour
- `'1 d'` - 1 day

## Security Considerations

1. **IP-based limiting**: Rate limits are applied per IP address. Be aware that users behind the same NAT/proxy share the same limit.

2. **Edge cases**: The system handles missing Upstash configuration gracefully but logs warnings to alert developers.

3. **Analytics**: Rate limit analytics are enabled, allowing you to monitor usage patterns in the Upstash dashboard.

4. **Sliding window**: The sliding window algorithm provides more accurate rate limiting compared to fixed windows, preventing burst requests at window boundaries.

## Monitoring

Monitor rate limiting in the Upstash dashboard:
- View request patterns and trends
- Identify potential abuse or attack patterns
- Adjust limits based on actual usage

## Troubleshooting

### Rate limiting not working in production

1. Verify environment variables are set correctly
2. Check Upstash dashboard for connection errors
3. Ensure your hosting platform forwards IP headers correctly

### Getting rate limited unexpectedly

1. Check if you're behind a shared proxy/VPN
2. Verify the time window and request count settings
3. Contact support if legitimate usage is being blocked

## Additional Resources

- [Upstash Ratelimit Documentation](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Upstash Redis Documentation](https://upstash.com/docs/redis)
