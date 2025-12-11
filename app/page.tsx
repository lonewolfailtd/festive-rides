'use client';

import { SnowfallEffect } from '@/components/SnowfallEffect';
import { FestiveHeader } from '@/components/FestiveHeader';
import { BookingForm } from '@/components/BookingForm/BookingForm';

export default function HomePage() {
  return (
    <>
      {/* Festive gradient background */}
      <div className="festive-gradient-bg" aria-hidden="true" />

      {/* Snowfall effect */}
      <SnowfallEffect />

      {/* Main content */}
      <div className="relative z-10 min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <FestiveHeader />

          {/* Introductory text */}
          <div className="text-center mb-8 fade-in">
            <div className="festive-card max-w-2xl mx-auto mb-8">
              <h2 className="text-2xl font-bold text-festive-charcoal mb-4">
                Welcome to Festive Rides!
              </h2>
              <p className="text-lg text-gray-700 mb-3">
                We're offering <strong>free community transport</strong> on Friday, December 13th, 2025 for residents of North Auckland.
              </p>
              <p className="text-gray-700 mb-3">
                Whether you need to visit the doctor, attend church, do your Christmas shopping, or visit whanau, we're here to help you get there safely and comfortably.
              </p>
              <p className="text-gray-700 font-semibold">
                Book your ride below - it only takes 2 minutes!
              </p>
            </div>
          </div>

          {/* Booking form */}
          <div className="festive-card max-w-3xl mx-auto fade-in">
            <h2 className="text-3xl font-bold text-center mb-6 text-festive-charcoal">
              Book Your Ride
            </h2>
            <BookingForm />
          </div>

          {/* Footer info */}
          <div className="mt-8 text-center text-white text-sm">
            <p className="mb-2">
              Questions? Contact us at{' '}
              <a
                href="mailto:info@festive-rides.nz"
                className="underline hover:text-amber-200"
              >
                info@festive-rides.nz
              </a>
            </p>
            <p>
              Festive Rides is a community service initiative.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
