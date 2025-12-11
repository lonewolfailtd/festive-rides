'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SnowfallEffect } from '@/components/SnowfallEffect';
import { FestiveHeader } from '@/components/FestiveHeader';

type VerificationState = 'verifying' | 'success' | 'error';

interface VerificationResult {
  success: boolean;
  message?: string;
  error?: string;
  booking?: {
    booking_reference: string;
    passenger_name: string;
    time_slot: string;
    pickup_address: string;
    destination_address: string;
    num_passengers: number;
    status: string;
  };
}

export default function VerifyBookingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = useState<VerificationState>('verifying');
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    const verifyBooking = async () => {
      try {
        const response = await fetch(`/api/bookings/verify/${token}`);
        const data = await response.json();

        if (response.ok) {
          setState('success');
          setResult(data);
        } else {
          setState('error');
          setResult(data);
        }
      } catch (error) {
        console.error('Verification error:', error);
        setState('error');
        setResult({
          success: false,
          error: 'An unexpected error occurred. Please try again.',
        });
      }
    };

    if (token) {
      verifyBooking();
    }
  }, [token]);

  return (
    <>
      {/* Festive gradient background */}
      <div className="festive-gradient-bg" aria-hidden="true" />

      {/* Snowfall effect */}
      <SnowfallEffect />

      {/* Main content */}
      <div className="relative z-10 min-h-screen py-4 sm:py-8 px-3 sm:px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <FestiveHeader />

          {/* Verification Status */}
          <div className="festive-card max-w-2xl mx-auto fade-in-delay-1">
            {state === 'verifying' && (
              <div className="text-center py-12">
                <div className="inline-block mb-6">
                  <div className="spinner w-16 h-16 border-4" />
                </div>
                <h2 className="section-title text-2xl mb-4">
                  Verifying Your Booking...
                </h2>
                <p className="text-gray-600">
                  Please wait while we confirm your booking
                </p>
              </div>
            )}

            {state === 'success' && result && (
              <div className="py-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                    <svg
                      className="w-12 h-12 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2 className="section-title text-2xl mb-4 text-green-700">
                    Booking Verified Successfully!
                  </h2>
                  <p className="text-lg text-gray-700 mb-2">
                    {result.message || 'Your festive ride is now confirmed'}
                  </p>
                </div>

                {result.booking && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 mb-6 border-l-4 border-green-600">
                    <h3 className="font-bold text-green-800 text-lg mb-4">
                      Booking Details
                    </h3>
                    <div className="space-y-3 text-gray-700">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">Reference:</span>
                        <span className="text-right font-mono text-green-700">
                          {result.booking.booking_reference}
                        </span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">Passenger:</span>
                        <span className="text-right">{result.booking.passenger_name}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">Pickup Time:</span>
                        <span className="text-right">{result.booking.time_slot}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">Pickup:</span>
                        <span className="text-right max-w-xs">{result.booking.pickup_address}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">Destination:</span>
                        <span className="text-right max-w-xs">{result.booking.destination_address}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">Passengers:</span>
                        <span className="text-right">{result.booking.num_passengers}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border-l-4 border-blue-600 p-5 rounded-lg mb-6">
                  <h3 className="font-bold text-blue-800 text-base mb-3">
                    What's Next?
                  </h3>
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">✓</span>
                      <span>A confirmation email has been sent to your inbox</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">✓</span>
                      <span>Please be ready 5 minutes before your pickup time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">✓</span>
                      <span>Save your booking reference for future reference</span>
                    </li>
                  </ul>
                </div>

                <div className="text-center space-y-4">
                  <button
                    onClick={() => router.push('/')}
                    className="festive-button-primary inline-block"
                  >
                    Back to Home
                  </button>
                  <div className="text-sm text-gray-600">
                    Need to cancel? Visit our{' '}
                    <a href="/cancel" className="text-[var(--color-forest)] underline hover:text-[var(--color-sage)]">
                      cancellation page
                    </a>
                  </div>
                </div>
              </div>
            )}

            {state === 'error' && result && (
              <div className="py-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
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
                  <h2 className="section-title text-2xl mb-4 text-red-700">
                    Verification Failed
                  </h2>
                  <p className="text-lg text-gray-700 mb-2">
                    {result.error || 'We could not verify your booking'}
                  </p>
                </div>

                <div className="bg-red-50 border-l-4 border-red-600 p-5 rounded-lg mb-6">
                  <h3 className="font-bold text-red-800 text-base mb-3">
                    Common Issues
                  </h3>
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">•</span>
                      <span>The verification link may have expired (24-hour limit)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">•</span>
                      <span>The booking may have already been verified</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">•</span>
                      <span>The time slot may have been booked by someone else</span>
                    </li>
                  </ul>
                </div>

                <div className="text-center space-y-4">
                  <button
                    onClick={() => router.push('/')}
                    className="festive-button-primary inline-block"
                  >
                    Book Again
                  </button>
                  <div className="text-sm text-gray-600">
                    Need help? Contact us at{' '}
                    <a
                      href="mailto:sammipetersen1720@yahoo.co.nz"
                      className="text-[var(--color-forest)] underline hover:text-[var(--color-sage)]"
                    >
                      sammipetersen1720@yahoo.co.nz
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer info */}
          <footer className="mt-12 mb-8 text-center text-[var(--color-soft-white)] fade-in-delay-2">
            <div className="space-y-3 text-sm">
              <p className="opacity-90">
                Questions? Contact us at{' '}
                <a
                  href="mailto:sammipetersen1720@yahoo.co.nz"
                  className="underline hover:text-[var(--color-mustard)] transition-colors font-medium"
                >
                  sammipetersen1720@yahoo.co.nz
                </a>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
