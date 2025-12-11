import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sanitizeCancellationReason } from '@/lib/utils/sanitize';
import { z } from 'zod';
import { withRateLimit } from '@/lib/rate-limit';

// Validation schema for cancellation
const cancelSchema = z.object({
  booking_reference: z.string().min(1, 'Booking reference is required'),
  passenger_email: z.string().email('Valid email is required'),
  cancellation_reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting: 5 requests per hour per IP
  return withRateLimit(request, 'cancellations', async () => {
    try {
      // Parse request body
      const body = await request.json();

      // Validate request data
      const validationResult = cancelSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { booking_reference, passenger_email, cancellation_reason } = validationResult.data;

      // Sanitize cancellation reason to prevent XSS and injection attacks
      const sanitizedCancellationReason = cancellation_reason
        ? sanitizeCancellationReason(cancellation_reason)
        : null;

      const supabase = createServerClient();

      // Find the booking
      const { data: booking, error: fetchError } = await (supabase as any)
        .from('bookings')
        .select('*')
        .eq('booking_reference', booking_reference)
        .eq('passenger_email', passenger_email)
        .eq('status', 'confirmed')
        .single();

      if (fetchError || !booking) {
        return NextResponse.json(
          {
            error: 'Booking not found or already cancelled. Please check your booking reference and email address.',
          },
          { status: 404 }
        );
      }

      // Update booking status to cancelled with sanitized cancellation reason
      const { error: updateError } = await (supabase as any)
        .from('bookings')
        .update({
          status: 'cancelled',
          ...(sanitizedCancellationReason && { cancellation_reason: sanitizedCancellationReason }),
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error('Cancellation update error:', updateError);
        return NextResponse.json(
          {
            error: 'Failed to cancel booking. Please try again.',
          },
          { status: 500 }
        );
      }

      // Return success response
      return NextResponse.json({
        success: true,
        message: 'Booking cancelled successfully',
        booking: {
          booking_reference: booking.booking_reference,
          passenger_name: booking.passenger_name,
          time_slot: booking.time_slot,
        },
      });
    } catch (error) {
      console.error('Cancellation error:', error);
      return NextResponse.json(
        {
          error: 'An unexpected error occurred. Please try again.',
        },
        { status: 500 }
      );
    }
  });
}
