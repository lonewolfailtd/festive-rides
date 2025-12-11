import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

    const supabase = createServerClient();

    // Find all pending bookings with expired verification tokens
    const { data: expiredBookings, error: fetchError } = await (supabase as any)
      .from('bookings')
      .select('id, booking_reference, verification_token_expires_at')
      .eq('status', 'pending')
      .lt('verification_token_expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired bookings:', fetchError);
      return NextResponse.json(
        {
          error: 'Failed to fetch expired bookings',
        },
        { status: 500 }
      );
    }

    if (!expiredBookings || expiredBookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired bookings found',
        cancelled_count: 0,
      });
    }

    // Cancel all expired bookings
    const { error: updateError } = await (supabase as any)
      .from('bookings')
      .update({
        status: 'cancelled',
        verification_token: null,
        verification_token_expires_at: null,
      })
      .in('id', expiredBookings.map((b: any) => b.id));

    if (updateError) {
      console.error('Error cancelling expired bookings:', updateError);
      return NextResponse.json(
        {
          error: 'Failed to cancel expired bookings',
        },
        { status: 500 }
      );
    }

    console.log(`Cancelled ${expiredBookings.length} expired pending bookings`);

    return NextResponse.json({
      success: true,
      message: `Successfully cancelled ${expiredBookings.length} expired booking(s)`,
      cancelled_count: expiredBookings.length,
      cancelled_references: expiredBookings.map((b: any) => b.booking_reference),
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
