import { convexServerClient } from '@/lib/convex/server';
import { api } from '@/convex/_generated/api';
import { ConfirmationCard } from '@/components/ConfirmationCard';
import { SnowfallEffect } from '@/components/SnowfallEffect';
import { FestiveHeader } from '@/components/FestiveHeader';
import { Booking } from '@/types';
import Link from 'next/link';

interface ConfirmationPageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const params = await searchParams;
  const bookingReference = params.ref;

  // If no booking reference provided
  if (!bookingReference) {
    return (
      <main className="min-h-screen relative">
        <div className="festive-gradient-bg" />
        <SnowfallEffect />

        <div className="relative z-10 container mx-auto px-4 py-8">
          <FestiveHeader />

          <div className="max-w-2xl mx-auto">
            <div className="festive-card text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                <svg
                  className="w-12 h-12 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-festive-charcoal mb-4">
                No Booking Reference Provided
              </h2>
              <p className="text-festive-charcoal mb-6">
                We couldn't find a booking reference in your URL. Please check your confirmation email or booking link.
              </p>
              <Link
                href="/"
                className="festive-button-primary inline-block"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Fetch booking from Convex
  let bookingDoc: Awaited<
    ReturnType<typeof convexServerClient.query<typeof api.bookings.getByReference>>
  > | null = null;
  let fetchError: unknown = null;
  try {
    bookingDoc = await convexServerClient.query(api.bookings.getByReference, {
      bookingReference,
    });
  } catch (err) {
    fetchError = err;
  }

  // If booking not found or error occurred
  if (fetchError || !bookingDoc) {
    return (
      <main className="min-h-screen relative">
        <div className="festive-gradient-bg" />
        <SnowfallEffect />

        <div className="relative z-10 container mx-auto px-4 py-8">
          <FestiveHeader />

          <div className="max-w-2xl mx-auto">
            <div className="festive-card text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                <svg
                  className="w-12 h-12 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-festive-charcoal mb-4">
                Booking Not Found
              </h2>
              <p className="text-festive-charcoal mb-2">
                We couldn't find a booking with reference:{' '}
                <strong className="font-mono text-festive-red">
                  {bookingReference}
                </strong>
              </p>
              <p className="text-gray-600 mb-6">
                Please check your booking reference and try again. If you continue to experience issues, please contact us.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/"
                  className="festive-button-primary"
                >
                  Return to Home
                </Link>
                <a
                  href="mailto:sammipetersen1720@yahoo.co.nz"
                  className="px-6 py-3 border-2 border-festive-green text-festive-green font-semibold rounded-full hover:bg-festive-green hover:text-white transition-colors"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Map Convex doc (camelCase) to the Booking shape ConfirmationCard expects (snake_case)
  const booking: Booking = {
    id: bookingDoc._id,
    created_at: new Date(bookingDoc._creationTime).toISOString(),
    passenger_name: bookingDoc.passengerName,
    passenger_phone: bookingDoc.passengerPhone,
    passenger_email: bookingDoc.passengerEmail,
    time_slot: bookingDoc.timeSlot,
    pickup_address: bookingDoc.pickupAddress,
    destination_category: bookingDoc.destinationCategory as Booking['destination_category'],
    destination_address: bookingDoc.destinationAddress,
    num_passengers: bookingDoc.numPassengers,
    special_requirements: bookingDoc.specialRequirements,
    booking_reference: bookingDoc.bookingReference,
    status: bookingDoc.status as Booking['status'],
    verification_token: bookingDoc.verificationToken,
    verification_token_expires_at:
      bookingDoc.verificationTokenExpiresAt !== undefined
        ? new Date(bookingDoc.verificationTokenExpiresAt).toISOString()
        : undefined,
    verified_at:
      bookingDoc.verifiedAt !== undefined
        ? new Date(bookingDoc.verifiedAt).toISOString()
        : undefined,
  };

  // Success - show confirmation
  return (
    <main className="min-h-screen relative">
      <div className="festive-gradient-bg" />
      <SnowfallEffect />

      <div className="relative z-10 container mx-auto px-4 py-8">
        <FestiveHeader />

        <div className="max-w-4xl mx-auto mb-8">
          <ConfirmationCard booking={booking} />
        </div>

        {/* Additional Actions */}
        <div className="max-w-4xl mx-auto text-center print:hidden">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border-2 border-festive-gold">
            <p className="text-festive-charcoal mb-4">
              Looking to make another booking?
            </p>
            <Link
              href="/"
              className="inline-block px-8 py-3 bg-white border-2 border-festive-green text-festive-green font-semibold rounded-full hover:bg-festive-green hover:text-white transition-colors"
            >
              Book Another Ride
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
