'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SnowfallEffect } from '@/components/SnowfallEffect';
import { FestiveHeader } from '@/components/FestiveHeader';
import Link from 'next/link';

function BookingRefDisplay() {
  const searchParams = useSearchParams();
  const bookingRef = searchParams.get('ref');

  if (!bookingRef) return null;

  return (
    <p className="text-base text-gray-600 font-mono">
      Booking Reference: <strong className="text-[var(--color-forest)]">{bookingRef}</strong>
    </p>
  );
}

export default function BookingPendingPage() {
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

          {/* Pending Status */}
          <div className="festive-card max-w-2xl mx-auto fade-in-delay-1">
            <div className="py-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
                  <svg
                    className="w-12 h-12 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="section-title text-2xl mb-4 text-yellow-700">
                  Check Your Email!
                </h2>
                <p className="text-lg text-gray-700 mb-2">
                  Your booking has been created and is waiting for verification
                </p>
                <Suspense fallback={<div className="text-base text-gray-500 font-mono">Loading...</div>}>
                  <BookingRefDisplay />
                </Suspense>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-600 p-5 rounded-lg mb-6">
                <h3 className="font-bold text-blue-800 text-base mb-3">
                  Next Steps
                </h3>
                <ol className="space-y-3 text-gray-700 text-sm list-decimal list-inside">
                  <li className="pl-2">
                    <strong>Check your email inbox</strong> - We've sent you a verification email
                  </li>
                  <li className="pl-2">
                    <strong>Click the verification link</strong> in the email to confirm your booking
                  </li>
                  <li className="pl-2">
                    <strong>Wait for confirmation</strong> - Once verified, you'll receive a final confirmation email
                  </li>
                </ol>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-600 p-5 rounded-lg mb-6">
                <h3 className="font-bold text-yellow-800 text-base mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Important
                </h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-0.5">⚠</span>
                    <span>
                      The verification link will <strong>expire in 24 hours</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-0.5">⚠</span>
                    <span>
                      Your booking will be <strong>automatically cancelled</strong> if not verified within 24 hours
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-0.5">⚠</span>
                    <span>
                      Your time slot is <strong>temporarily reserved</strong> but not confirmed yet
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 border-l-4 border-gray-400 p-5 rounded-lg mb-6">
                <h3 className="font-bold text-gray-800 text-base mb-3">
                  Didn't receive the email?
                </h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-600 mt-0.5">•</span>
                    <span>Check your spam or junk folder</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-600 mt-0.5">•</span>
                    <span>Make sure you entered the correct email address</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-600 mt-0.5">•</span>
                    <span>Wait a few minutes - emails can take time to arrive</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-600 mt-0.5">•</span>
                    <span>
                      If you still don't see it, contact us at{' '}
                      <a
                        href="mailto:sammipetersen1720@yahoo.co.nz"
                        className="text-[var(--color-forest)] underline hover:text-[var(--color-sage)]"
                      >
                        sammipetersen1720@yahoo.co.nz
                      </a>
                    </span>
                  </li>
                </ul>
              </div>

              <div className="text-center space-y-4">
                <Link href="/" className="festive-button-primary inline-block">
                  Back to Home
                </Link>
              </div>
            </div>
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
