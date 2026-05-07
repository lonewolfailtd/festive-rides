import { NextRequest, NextResponse } from 'next/server';
import { convexServerClient } from '@/lib/convex/server';
import { api } from '@/convex/_generated/api';
import { withRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Apply rate limiting: 60 requests per minute per IP
  return withRateLimit(request, 'availability', async () => {
    try {
      const { slots, totalAvailable } = await convexServerClient.query(
        api.bookings.availableSlots,
        {}
      );

      return NextResponse.json({
        slots,
        totalAvailable,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Availability check error:', error);
      return NextResponse.json(
        {
          error: 'An unexpected error occurred',
        },
        { status: 500 }
      );
    }
  });
}
