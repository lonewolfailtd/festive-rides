import { NextRequest, NextResponse } from 'next/server';
import { convexServerClient } from '@/lib/convex/server';
import { api } from '@/convex/_generated/api';
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
        : undefined;

      let result;
      try {
        result = await convexServerClient.mutation(api.bookings.cancel, {
          bookingReference: booking_reference,
          passengerEmail: passenger_email,
          reason: sanitizedCancellationReason || undefined,
        });
      } catch (err) {
        console.error('Convex cancel error:', err);
        return NextResponse.json(
          {
            error: 'Failed to cancel booking. Please try again.',
          },
          { status: 500 }
        );
      }

      if (!result.ok) {
        // Either notFound or emailMismatch — return same generic 404 message
        // (mirrors original behaviour which only confirmed-status bookings could match)
        return NextResponse.json(
          {
            error: 'Booking not found or already cancelled. Please check your booking reference and email address.',
          },
          { status: 404 }
        );
      }

      const b = result.booking;
      return NextResponse.json({
        success: true,
        message: result.alreadyCancelled
          ? 'Booking was already cancelled'
          : 'Booking cancelled successfully',
        booking: {
          booking_reference: b.bookingReference,
          passenger_name: b.passengerName,
          time_slot: b.timeSlot,
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
