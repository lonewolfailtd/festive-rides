import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { bookingSchema } from '@/lib/utils/validation';
import { generateBookingReference } from '@/lib/utils/booking-reference';
import { resend, FROM_EMAIL, ADMIN_EMAIL } from '@/lib/email/resend';
import { passengerConfirmationTemplate, adminNotificationTemplate } from '@/lib/email/templates';
import { Booking } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate request data with Zod
    const validationResult = bookingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const supabase = createServerClient();

    // Check if time slot is still available (race condition check)
    const { data: existingBooking } = await (supabase as any)
      .from('bookings')
      .select('id')
      .eq('time_slot', data.time_slot)
      .eq('status', 'confirmed')
      .single();

    if (existingBooking) {
      return NextResponse.json(
        {
          error: 'This time slot has just been booked by someone else. Please select another time.',
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Generate unique booking reference
    const bookingReference = generateBookingReference();

    // Insert booking into database
    const { data: booking, error: insertError } = await (supabase as any)
      .from('bookings')
      .insert({
        passenger_name: data.passenger_name,
        passenger_phone: data.passenger_phone,
        passenger_email: data.passenger_email,
        time_slot: data.time_slot,
        pickup_address: data.pickup_address,
        destination_category: data.destination_category,
        destination_address: data.destination_address,
        num_passengers: data.num_passengers,
        special_requirements: data.special_requirements || null,
        booking_reference: bookingReference,
        status: 'confirmed',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);

      // Check if it's a unique constraint violation (race condition)
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            error: 'This time slot was just booked. Please select another time.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to create booking. Please try again.',
        },
        { status: 500 }
      );
    }

    // Send confirmation emails (fire and forget - don't block response)
    sendBookingEmails(booking as Booking).catch((error) => {
      console.error('Email sending error:', error);
      // Log error but don't fail the booking
    });

    // Return success response
    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        passenger_name: booking.passenger_name,
        time_slot: booking.time_slot,
      },
    });
  } catch (error) {
    console.error('Booking error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}

/**
 * Send confirmation emails to passenger and admin
 */
async function sendBookingEmails(booking: Booking) {
  try {
    // Send email to passenger
    await resend.emails.send({
      from: FROM_EMAIL,
      to: booking.passenger_email,
      subject: `🎄 Ride Confirmed - ${booking.booking_reference}`,
      html: passengerConfirmationTemplate(booking),
    });

    // Send email to admin
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Booking: ${booking.booking_reference} - ${booking.time_slot}`,
      html: adminNotificationTemplate(booking),
    });
  } catch (error) {
    // Re-throw to be caught by the caller
    throw error;
  }
}
