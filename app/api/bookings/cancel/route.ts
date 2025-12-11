import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema for cancellation
const cancelSchema = z.object({
  booking_reference: z.string().min(1, 'Booking reference is required'),
  passenger_email: z.string().email('Valid email is required'),
  cancellation_reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
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
    const supabase = createServerClient();

    // Find the booking
    const { data: booking, error: fetchError } = await supabase
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

    // Update booking status to cancelled
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
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
}
