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
          <div className="text-center mb-10 fade-in-delay-1">
            <div className="intro-card max-w-2xl mx-auto">
              <h2 className="section-title text-center mb-4">
                Welcome to Festive Rides
              </h2>
              <div className="space-y-4 text-[var(--color-charcoal)]">
                <p className="text-lg leading-relaxed">
                  We're offering <strong className="text-[var(--color-forest)] font-semibold">free community transport</strong> on Saturday, December 13th, 2025 for residents of North Auckland.
                </p>
                <p className="leading-relaxed">
                  Whether you need to visit the doctor, attend church, do your Christmas shopping, or visit whānau, we're here to help you get there safely and comfortably.
                </p>
                <div className="pt-2">
                  <div className="inline-block px-6 py-3 bg-gradient-to-r from-[var(--color-sage)]/10 to-[var(--color-terracotta)]/10 rounded-full">
                    <p className="text-[var(--color-forest)] font-semibold text-sm tracking-wide">
                      Book your ride below — it only takes 2 minutes
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Service Guidelines */}
          <div className="glass-card max-w-3xl mx-auto fade-in-delay-2 mb-12">
            <h2 className="section-title text-center mb-6">
              Service Guidelines
            </h2>
            <div className="space-y-6">
              {/* Who can ride */}
              <div className="bg-green-50 rounded-lg p-6 border-l-4 border-green-600">
                <h3 className="font-bold text-green-800 text-lg mb-4 flex items-center gap-2">
                  ✅ Our rides are suitable for:
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Adults and parents with children (under-18 passengers must be accompanied by an adult)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>People who are well and able to travel safely</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Passengers with standard mobility needs (walkers are fine)</span>
                  </li>
                </ul>
              </div>

              {/* Who cannot ride */}
              <div className="bg-orange-50 rounded-lg p-6 border-l-4 border-orange-600">
                <h3 className="font-bold text-orange-800 text-lg mb-4 flex items-center gap-2">
                  ⚠️ For safety reasons, we aren't able to provide rides for:
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 mt-1">•</span>
                    <span>Anyone who is unwell or needs medical care</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 mt-1">•</span>
                    <span>Anyone under the age of 18 travelling alone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 mt-1">•</span>
                    <span>Passengers needing specialised vehicle assistance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 mt-1">•</span>
                    <span>Anyone affected by alcohol or other substances</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Booking form */}
          <div className="festive-card max-w-3xl mx-auto fade-in-delay-3">
            <h2 className="section-title text-center mb-8">
              Book Your Ride
            </h2>
            <BookingForm />
          </div>

          {/* Cancellation Link */}
          <div className="text-center mt-8 fade-in-delay-4">
            <a
              href="/cancel"
              className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-[var(--color-soft-white)] rounded-lg transition-all duration-300 border border-white/20 hover:border-white/30"
            >
              Need to cancel your booking? Click here
            </a>
          </div>

          {/* Footer info */}
          <footer className="mt-12 mb-8 text-center text-[var(--color-soft-white)] fade-in-delay-4">
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
              <div className="flex items-center justify-center gap-3 opacity-75">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--color-soft-white)]"></div>
                <p className="text-xs tracking-wider">
                  A COMMUNITY SERVICE INITIATIVE
                </p>
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--color-soft-white)]"></div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
