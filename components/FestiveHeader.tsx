'use client';

export function FestiveHeader() {
  return (
    <header className="text-center py-12 px-4 fade-in">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <img
          src="/festive-rides-logo.png"
          alt="Festive Rides Logo"
          className="w-96 h-auto rounded-3xl shadow-2xl opacity-95 hover:opacity-100 transition-opacity duration-300"
        />
      </div>

      {/* Decorative line above title */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="h-[2px] w-16 bg-gradient-to-r from-transparent via-[var(--color-terracotta)] to-transparent opacity-60"></div>
        <div className="text-[var(--color-soft-white)] text-sm tracking-[0.3em] font-light opacity-80">
          DECEMBER 13, 2025
        </div>
        <div className="h-[2px] w-16 bg-gradient-to-r from-transparent via-[var(--color-terracotta)] to-transparent opacity-60"></div>
      </div>

      {/* Subtitle */}
      <p className="festive-subtitle mb-6">
        Free Community Transport · North Auckland
      </p>

      {/* Date and time with decorative elements */}
      <div className="inline-block relative">
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[var(--color-mustard)] opacity-30 blur-sm"></div>
        <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[var(--color-sage)] opacity-30 blur-sm"></div>
        <p className="text-lg font-semibold text-[var(--color-soft-white)] px-8 py-2 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent backdrop-blur-sm">
          Saturday, 13th December · 9:00 AM - 5:00 PM
        </p>
      </div>
    </header>
  );
}
