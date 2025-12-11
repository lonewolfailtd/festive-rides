import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { isValidVerificationToken, isTokenExpired } from '@/lib/utils/verification-token';
import { sendBookingConfirmationEmails } from '../../route';
import { Booking } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token format
    if (!isValidVerificationToken(token)) {
      return NextResponse.json(
        {
          error: 'Invalid verification token format',
        },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Find booking with this verification token
    const { data: booking, error: fetchError } = await (supabase as any)
      .from('bookings')
      .select('*')
      .eq('verification_token', token)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        {
          error: 'Booking not found or token is invalid',
        },
        { status: 404 }
      );
    }

    // Check if already verified
    if (booking.status === 'confirmed') {
      return NextResponse.json({
        success: true,
        message: 'This booking has already been verified',
        booking: {
          booking_reference: booking.booking_reference,
          passenger_name: booking.passenger_name,
          time_slot: booking.time_slot,
          status: 'confirmed',
        },
      });
    }

    // Check if booking was cancelled
    if (booking.status === 'cancelled') {
      return NextResponse.json(
        {
          error: 'This booking has been cancelled',
        },
        { status: 410 } // 410 Gone
      );
    }

    // Check if token has expired
    if (isTokenExpired(booking.verification_token_expires_at)) {
      // Mark booking as cancelled
      await (supabase as any)
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      return NextResponse.json(
        {
          error: 'Verification link has expired. Your booking has been cancelled. Please book again.',
        },
        { status: 410 } // 410 Gone
      );
    }

    // Check if time slot is still available (race condition check)
    const { data: existingBooking } = await (supabase as any)
      .from('bookings')
      .select('id')
      .eq('time_slot', booking.time_slot)
      .eq('status', 'confirmed')
      .neq('id', booking.id)
      .single();

    if (existingBooking) {
      // Mark this booking as cancelled
      await (supabase as any)
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      return NextResponse.json(
        {
          error: 'This time slot has been booked by someone else. Please book again with a different time.',
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Update booking status to confirmed
    const { data: updatedBooking, error: updateError } = await (supabase as any)
      .from('bookings')
      .update({
        status: 'confirmed',
        verified_at: new Date().toISOString(),
        verification_token: null, // Clear token after verification
        verification_token_expires_at: null,
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        {
          error: 'Failed to verify booking. Please try again.',
        },
        { status: 500 }
      );
    }

    // Send confirmation emails (fire and forget)
    sendBookingConfirmationEmails(updatedBooking as Booking).catch((error) => {
      console.error('Email sending error:', error);
      // Log error but don't fail the verification
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Booking verified successfully!',
      booking: {
        booking_reference: updatedBooking.booking_reference,
        passenger_name: updatedBooking.passenger_name,
        time_slot: updatedBooking.time_slot,
        pickup_address: updatedBooking.pickup_address,
        destination_address: updatedBooking.destination_address,
        num_passengers: updatedBooking.num_passengers,
        status: 'confirmed',
      },
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
