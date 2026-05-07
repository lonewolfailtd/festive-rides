'use client';

import { useEffect, useState } from 'react';

export function BookingClosedModal() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if we're past 5pm on December 13th, 2025
    const now = new Date();
    const closeTime = new Date('2025-12-13T17:00:00'); // 5:00 PM
    const eventEnd = new Date('2025-12-14T00:00:00'); // Midnight

    // Show modal if current time is between 5pm Dec 13 and midnight Dec 14
    if (now >= closeTime && now < eventEnd) {
      setIsVisible(true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[var(--color-forest)]/95 via-[var(--color-deep-teal)]/95 to-[var(--color-burgundy)]/95 backdrop-blur-md"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(212, 160, 36, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(167, 196, 160, 0.1) 0%, transparent 50%)
          `
        }}
      />

      {/* Floating snowflakes decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="snowflake"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${8 + Math.random() * 10}s`,
              animationDelay: `${Math.random() * 5}s`,
              fontSize: `${0.8 + Math.random() * 0.8}rem`,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* Modal content */}
      <div className="relative w-full max-w-2xl">
        {/* Decorative glow effects */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-[var(--color-mustard)] rounded-full blur-3xl opacity-20" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[var(--color-sage)] rounded-full blur-3xl opacity-20" />

        {/* Main card */}
        <div className="relative bg-gradient-to-br from-[var(--color-soft-white)] via-[var(--color-cream)] to-[var(--color-soft-white)] rounded-3xl shadow-2xl overflow-hidden border-2 border-white/50">
          {/* Top decorative bar */}
          <div className="h-2 bg-gradient-to-r from-[var(--color-terracotta)] via-[var(--color-burgundy)] to-[var(--color-forest)]" />

          {/* Content */}
          <div className="p-8 sm:p-12 text-center space-y-6">
            {/* Decorative line above */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-[2px] w-16 bg-gradient-to-r from-transparent via-[var(--color-terracotta)] to-transparent opacity-60" />
              <div className="text-[var(--color-forest)] text-xs tracking-[0.3em] font-light opacity-80">
                BOOKING CLOSED
              </div>
              <div className="h-[2px] w-16 bg-gradient-to-r from-transparent via-[var(--color-terracotta)] to-transparent opacity-60" />
            </div>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-[var(--color-terracotta)]/20 to-[var(--color-sage)]/20 flex items-center justify-center shadow-lg">
                <span className="text-5xl sm:text-6xl">🎄</span>
              </div>
            </div>

            {/* Main heading */}
            <h2 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-semibold bg-gradient-to-r from-[var(--color-terracotta)] via-[var(--color-burgundy)] to-[var(--color-forest)] bg-clip-text text-transparent leading-tight">
              Thank You for Your Interest
            </h2>

            {/* Subheading */}
            <div className="space-y-4 max-w-lg mx-auto">
              <p className="text-lg sm:text-xl text-[var(--color-charcoal)] font-medium">
                Our free booking period has closed for today
              </p>

              {/* Time indicator */}
              <div className="inline-block px-6 py-3 bg-gradient-to-r from-[var(--color-sage)]/10 to-[var(--color-terracotta)]/10 rounded-full border border-[var(--color-sage)]/30">
                <p className="text-[var(--color-forest)] font-semibold text-sm tracking-wide">
                  Last pickup time: 4:30 PM • Service ends: 5:00 PM
                </p>
              </div>
            </div>

            {/* Main message */}
            <div className="bg-gradient-to-br from-[var(--color-sage)]/5 to-[var(--color-terracotta)]/5 rounded-2xl p-6 sm:p-8 border border-[var(--color-sage)]/20 space-y-4">
              <p className="text-base sm:text-lg text-[var(--color-charcoal)] leading-relaxed">
                All of our rides for Saturday, December 13th have been scheduled. Our drivers are currently completing their final trips of the day.
              </p>
              <p className="text-base sm:text-lg text-[var(--color-charcoal)] leading-relaxed">
                We hope this initiative has helped our community get to where they needed to go. Thank you for your understanding!
              </p>
            </div>

            {/* Future notice */}
            <div className="pt-4">
              <p className="text-base text-[var(--color-forest)] font-semibold mb-3">
                Want to stay updated on future community events?
              </p>
              <p className="text-sm text-[var(--color-charcoal)]/80 leading-relaxed">
                Contact us at{' '}
                <a
                  href="mailto:sammipetersen1720@yahoo.co.nz"
                  className="text-[var(--color-terracotta)] font-semibold underline hover:text-[var(--color-burgundy)] transition-colors"
                >
                  sammipetersen1720@yahoo.co.nz
                </a>
                {' '}to learn about upcoming Festive Rides events and community transport initiatives.
              </p>
            </div>

            {/* Decorative elements */}
            <div className="flex items-center justify-center gap-3 pt-6 opacity-60">
              <span className="text-2xl">✨</span>
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-[var(--color-sage)] to-transparent" />
              <span className="text-sm font-['Cormorant_Garamond'] text-[var(--color-forest)] tracking-wider">
                Happy Holidays
              </span>
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-[var(--color-sage)] to-transparent" />
              <span className="text-2xl">🎁</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
