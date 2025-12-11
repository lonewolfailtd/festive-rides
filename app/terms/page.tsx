'use client';

import { FestiveHeader } from '@/components/FestiveHeader';
import { SnowfallEffect } from '@/components/SnowfallEffect';

export default function TermsPage() {
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
              Terms of Service
            </h1>

            <div className="prose prose-sm sm:prose-base max-w-none space-y-6 text-gray-700">
              <p className="text-sm text-gray-500">
                <strong>Last Updated:</strong> December 11, 2024
              </p>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  1. Service Description
                </h2>
                <p>
                  Festive Rides is a <strong>free community transport service</strong> operating on{' '}
                  <strong>Saturday, December 13, 2025</strong>, between 9:00 AM and 5:00 PM for residents
                  of the North Shore, Auckland.
                </p>
                <p>
                  This is a volunteer-run community initiative. We provide rides to help community members
                  access essential services, attend events, and visit family during the festive season.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  2. Eligibility
                </h2>
                <p><strong>Our service is available for:</strong></p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Adults and parents with children (under-18 passengers must be accompanied by an adult)</li>
                  <li>People who are well and able to travel safely</li>
                  <li>Passengers with standard mobility needs (walkers are acceptable)</li>
                </ul>

                <p className="mt-4"><strong>We cannot accommodate:</strong></p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Anyone who is unwell or needs medical care</li>
                  <li>Anyone under 18 traveling alone</li>
                  <li>Passengers requiring specialized vehicle assistance</li>
                  <li>Anyone affected by alcohol or other substances</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  3. Passenger Responsibilities
                </h2>
                <p>By booking a ride, you agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Follow all road safety rules</li>
                  <li>Remain seated with seatbelt fastened at all times</li>
                  <li>Treat the vehicle and driver with respect</li>
                  <li>Be ready at pickup location 5 minutes before scheduled time</li>
                  <li>Provide accurate contact and address information</li>
                  <li>Cancel your booking if you cannot attend</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  4. Liability and Damage
                </h2>
                <div className="bg-orange-50 border-l-4 border-orange-600 p-4 rounded">
                  <p className="font-semibold">⚠️ Important Legal Notice:</p>
                  <ul className="list-disc pl-6 space-y-2 mt-2">
                    <li>
                      <strong>You are liable for any damage</strong> caused to the vehicle during transport
                    </li>
                    <li>This includes damage caused by you or anyone in your party</li>
                    <li>
                      While we provide insurance coverage for our vehicles, passengers may be held responsible
                      for damages resulting from negligence or misconduct
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  5. Service Limitations
                </h2>
                <p>
                  <strong>This is a FREE community service.</strong> We reserve the right to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Refuse service to anyone who does not meet eligibility criteria</li>
                  <li>Cancel bookings if safety concerns arise</li>
                  <li>Modify schedules due to unforeseen circumstances</li>
                  <li>Limit the number of bookings per person</li>
                </ul>

                <p className="mt-4">
                  We are <strong>not liable</strong> for:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Delays due to traffic, weather, or other circumstances beyond our control</li>
                  <li>Missed appointments resulting from service delays</li>
                  <li>Lost or forgotten items</li>
                  <li>Indirect or consequential damages</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  6. Booking and Cancellation
                </h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Bookings are subject to availability</li>
                  <li>Maximum 3 passengers per booking</li>
                  <li>You will receive a confirmation email with booking reference</li>
                  <li>To cancel, use the cancellation link in your confirmation email</li>
                  <li>
                    <strong>No-shows without cancellation</strong> may affect future booking privileges
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  7. Privacy
                </h2>
                <p>
                  Your personal information will be used solely to provide this service.
                  See our{' '}
                  <a
                    href="/privacy"
                    className="text-[var(--color-forest)] underline hover:text-[var(--color-sage)]"
                  >
                    Privacy Policy
                  </a>{' '}
                  for details.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  8. Dispute Resolution
                </h2>
                <p>
                  If you have any concerns or complaints about our service, please contact us at{' '}
                  <a
                    href="mailto:sammipetersen1720@yahoo.co.nz"
                    className="text-[var(--color-forest)] underline hover:text-[var(--color-sage)]"
                  >
                    sammipetersen1720@yahoo.co.nz
                  </a>
                  . We will make every effort to resolve issues amicably.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-bold text-[var(--color-forest)] mt-6 mb-3">
                  9. Changes to Terms
                </h2>
                <p>
                  We reserve the right to modify these terms at any time. Changes will be posted on this page
                  with an updated "Last Updated" date.
                </p>
              </section>

              <section className="bg-green-50 p-4 rounded-lg border-l-4 border-green-600 mt-8">
                <p className="text-sm">
                  <strong>By booking a ride, you acknowledge that you have read, understood, and agree
                  to these Terms of Service.</strong>
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
