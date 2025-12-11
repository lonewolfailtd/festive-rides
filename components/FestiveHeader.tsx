'use client';

export function FestiveHeader() {
  return (
    <header className="text-center py-6 sm:py-12 px-4 fade-in">
      {/* Logo */}
      <div className="flex justify-center mb-4 sm:mb-6">
        <img
          src="/festive-rides-logo.png"
          alt="Festive Rides Logo"
          className="w-64 sm:w-80 md:w-96 h-auto rounded-2xl sm:rounded-3xl shadow-2xl opacity-95 hover:opacity-100 transition-opacity duration-300"
        />
      </div>

      {/* Decorative line above title */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="h-[2px] w-8 sm:w-16 bg-gradient-to-r from-transparent via-[var(--color-terracotta)] to-transparent opacity-60"></div>
        <div className="text-[var(--color-soft-white)] text-xs sm:text-sm tracking-[0.2em] sm:tracking-[0.3em] font-light opacity-80">
          DECEMBER 13, 2025
        </div>
        <div className="h-[2px] w-8 sm:w-16 bg-gradient-to-r from-transparent via-[var(--color-terracotta)] to-transparent opacity-60"></div>
      </div>

      {/* Subtitle */}
      <p className="festive-subtitle mb-4 sm:mb-6 text-sm sm:text-base">
        Free Community Transport · North Auckland
      </p>

      {/* Date and time with decorative elements */}
      <div className="inline-block relative px-4 sm:px-0">
        <div className="hidden sm:block absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[var(--color-mustard)] opacity-30 blur-sm"></div>
        <div className="hidden sm:block absolute -right-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[var(--color-sage)] opacity-30 blur-sm"></div>
        <p className="text-sm sm:text-base md:text-lg font-semibold text-[var(--color-soft-white)] px-4 sm:px-8 py-2 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent backdrop-blur-sm">
          Saturday, 13th December · 9:00 AM - 5:00 PM
        </p>
      </div>
    </header>
  );
}
