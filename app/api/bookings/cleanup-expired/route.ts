import { NextRequest, NextResponse } from 'next/server';
import { convexServerClient } from '@/lib/convex/server';
import { api } from '@/convex/_generated/api';

/**
 * Cleanup endpoint to cancel expired pending bookings
 * This should be called periodically (e.g., via cron job)
 *
 * Security: This endpoint should be protected with an API key in production
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key (add this to .env.local as CLEANUP_API_KEY)
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.CLEANUP_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    let result;
    try {
      result = await convexServerClient.mutation(api.bookings.cleanupExpiredPublic, {});
    } catch (err) {
      console.error('Error cancelling expired bookings:', err);
      return NextResponse.json(
        {
          error: 'Failed to cancel expired bookings',
        },
        { status: 500 }
      );
    }

    if (result.cancelledCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired bookings found',
        cancelled_count: 0,
      });
    }

    console.log(`Cancelled ${result.cancelledCount} expired pending bookings`);

    return NextResponse.json({
      success: true,
      message: `Successfully cancelled ${result.cancelledCount} expired booking(s)`,
      cancelled_count: result.cancelledCount,
      cancelled_references: result.cancelledReferences,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing (remove in production or protect with auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
