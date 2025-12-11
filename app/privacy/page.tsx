'use client';

import { FestiveHeader } from '@/components/FestiveHeader';
import { SnowfallEffect } from '@/components/SnowfallEffect';

export default function PrivacyPage() {
  return (
    <>
      {/* Festive gradient background */}
      <div className="festive-gradient-bg" aria-hidden="true" />

      {/* Snowfall effect */}
      <SnowfallEffect />

      <main className="relative z-10 min-h-screen py-4 sm:py-8 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <FestiveHeader />

          <div className="festive-card max-w-3xl mx-auto fade-in-delay-1">
            <h1 className="section-title text-center mb-6 sm:mb-8">
              Privacy Policy
            </h1>

            <div className="prose prose-sm sm:prose-base max-w-none space-y-6 text-gray-700">
              <p className="text-sm text-gray-500">
                <strong>Last Updated:</strong> December 11, 2024
              </p>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  1. Information We Collect
                </h2>
                <p>When you book a ride with Festive Rides, we collect:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Personal Information:</strong> Name, email address, phone number</li>
                  <li><strong>Booking Details:</strong> Pickup address, destination address, time slot, number of passengers</li>
                  <li><strong>Special Requirements:</strong> Any accessibility or special needs you provide</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  2. How We Use Your Information
                </h2>
                <p>We use your information to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Confirm and manage your ride booking</li>
                  <li>Send you booking confirmations and updates via email</li>
                  <li>Coordinate pickups and drop-offs with our drivers</li>
                  <li>Contact you in case of schedule changes or emergencies</li>
                  <li>Improve our service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  3. Information Sharing
                </h2>
                <p>We do NOT sell your personal information. We may share your data with:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Our Drivers:</strong> To facilitate your ride (name, phone, pickup/destination)</li>
                  <li><strong>Service Providers:</strong> Email service (Resend) and database (Supabase) for operational purposes</li>
                  <li><strong>Legal Requirements:</strong> If required by law or to protect safety</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  4. Data Storage and Security
                </h2>
                <p>
                  Your data is stored securely using industry-standard encryption. We use Supabase (cloud database)
                  and Resend (email service) which comply with international security standards.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  5. Data Retention
                </h2>
                <p>
                  We retain your booking information for 30 days after the service date for operational purposes.
                  After this period, your personal data will be anonymized or deleted.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  6. Your Rights
                </h2>
                <p>You have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access your personal data</li>
                  <li>Correct inaccurate data</li>
                  <li>Request deletion of your data</li>
                  <li>Withdraw consent at any time</li>
                  <li>Cancel your booking</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  7. Cookies and Tracking
                </h2>
                <p>
                  This website does not use cookies or tracking technologies. We do not track your browsing behavior.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  8. Contact Us
                </h2>
                <p>
                  If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:
                </p>
                <p className="mt-2">
                  <strong>Email:</strong>{' '}
                  <a
                    href="mailto:sammipetersen1720@yahoo.co.nz"
                    className="text-[var(--color-forest)] underline hover:text-[var(--color-sage)]"
                  >
                    sammipetersen1720@yahoo.co.nz
                  </a>
                </p>
              </section>

              <section className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600 mt-8">
                <p className="text-sm">
                  <strong>Note:</strong> This is a one-day community service event. We collect only the minimum
                  information necessary to provide free transport on December 13, 2025.
                </p>
              </section>
            </div>

            <div className="text-center mt-8">
              <a
                href="/"
                className="text-[var(--color-forest)] hover:text-[var(--color-sage)] transition-colors font-medium"
              >
                ← Back to Home
              </a>
            </div>
          </div>

          {/* Footer */}
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
      </main>
    </>
  );
}
