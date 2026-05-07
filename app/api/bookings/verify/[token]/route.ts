import { NextRequest, NextResponse } from 'next/server';
import { convexServerClient } from '@/lib/convex/server';
import { api } from '@/convex/_generated/api';
import { isValidVerificationToken } from '@/lib/utils/verification-token';
import { sendBookingConfirmationEmails, convexBookingToLegacy } from '../../route';

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

    let result;
    try {
      result = await convexServerClient.mutation(api.bookings.verifyToken, { token });
    } catch (err) {
      console.error('Convex verifyToken error:', err);
      return NextResponse.json(
        {
          error: 'Failed to verify booking. Please try again.',
        },
        { status: 500 }
      );
    }

    switch (result.kind) {
      case 'notFound':
        return NextResponse.json(
          { error: 'Booking not found or token is invalid' },
          { status: 404 }
        );

      case 'alreadyConfirmed': {
        const b = result.booking;
        return NextResponse.json({
          success: true,
          message: 'This booking has already been verified',
          booking: {
            booking_reference: b.bookingReference,
            passenger_name: b.passengerName,
            time_slot: b.timeSlot,
            status: 'confirmed',
          },
        });
      }

      case 'cancelled':
        if (result.reason === 'expired') {
          return NextResponse.json(
            { error: 'Verification link has expired. Your booking has been cancelled. Please book again.' },
            { status: 410 }
          );
        }
        if (result.reason === 'slotTaken') {
          return NextResponse.json(
            { error: 'This time slot has been booked by someone else. Please book again with a different time.' },
            { status: 409 }
          );
        }
        // userCancelled
        return NextResponse.json(
          { error: 'This booking has been cancelled' },
          { status: 410 }
        );

      case 'confirmed': {
        const updated = result.booking;
        const legacy = convexBookingToLegacy(updated);

        // Send confirmation emails (fire and forget)
        sendBookingConfirmationEmails(legacy).catch((error) => {
          console.error('Email sending error:', error);
        });

        return NextResponse.json({
          success: true,
          message: 'Booking verified successfully!',
          booking: {
            booking_reference: updated.bookingReference,
            passenger_name: updated.passengerName,
            time_slot: updated.timeSlot,
            pickup_address: updated.pickupAddress,
            destination_address: updated.destinationAddress,
            num_passengers: updated.numPassengers,
            status: 'confirmed',
          },
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unexpected verification result' },
          { status: 500 }
        );
    }
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
