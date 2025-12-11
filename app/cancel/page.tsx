'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { FestiveHeader } from '@/components/FestiveHeader';
import { SnowfallEffect } from '@/components/SnowfallEffect';

const cancelSchema = z.object({
  booking_reference: z.string().min(1, 'Booking reference is required'),
  passenger_email: z.string().email('Valid email address is required'),
  cancellation_reason: z.string().optional(),
});

type CancelFormData = z.infer<typeof cancelSchema>;

export default function CancelPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelFormData>({
    resolver: zodResolver(cancelSchema),
  });

  const onSubmit = async (data: CancelFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to cancel booking');
        return;
      }

      // Success
      toast.success('Booking cancelled successfully');

      // Redirect to home after a short delay
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Cancellation error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Festive gradient background */}
      <div className="festive-gradient-bg" aria-hidden="true" />

      {/* Snowfall effect */}
      <SnowfallEffect />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <FestiveHeader />

          {/* Cancellation Form Card */}
          <div className="festive-card max-w-xl mx-auto fade-in-delay-1">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="section-title mb-2">Cancel Your Booking</h2>
              <p className="text-[var(--color-charcoal)]">
                We're sorry you can't make it. Please enter your booking details below.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
              {/* Booking Reference */}
              <div className="form-field">
                <label htmlFor="booking_reference" className="festive-label">
                  Booking Reference <span className="text-festive-red">*</span>
                </label>
                <input
                  id="booking_reference"
                  type="text"
                  className="festive-input"
                  placeholder="e.g., FR-LXDTRX"
                  {...register('booking_reference')}
                  aria-invalid={errors.booking_reference ? 'true' : 'false'}
                  aria-describedby={
                    errors.booking_reference ? 'booking_reference-error' : undefined
                  }
                />
                {errors.booking_reference && (
                  <p id="booking_reference-error" className="error-message" role="alert">
                    {errors.booking_reference.message}
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  Found in your confirmation email
                </p>
              </div>

              {/* Email */}
              <div className="form-field">
                <label htmlFor="passenger_email" className="festive-label">
                  Email Address <span className="text-festive-red">*</span>
                </label>
                <input
                  id="passenger_email"
                  type="email"
                  className="festive-input"
                  placeholder="e.g., john.smith@email.com"
                  {...register('passenger_email')}
                  aria-invalid={errors.passenger_email ? 'true' : 'false'}
                  aria-describedby={
                    errors.passenger_email ? 'passenger_email-error' : undefined
                  }
                />
                {errors.passenger_email && (
                  <p id="passenger_email-error" className="error-message" role="alert">
                    {errors.passenger_email.message}
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  Must match the email used for booking
                </p>
              </div>

              {/* Cancellation Reason (Optional) */}
              <div className="form-field">
                <label htmlFor="cancellation_reason" className="festive-label">
                  Reason for Cancellation <span className="text-gray-500">(Optional)</span>
                </label>
                <textarea
                  id="cancellation_reason"
                  className="festive-textarea"
                  placeholder="e.g., No longer need transport, plans changed, etc."
                  rows={3}
                  {...register('cancellation_reason')}
                />
                <p className="text-sm text-gray-600 mt-1">
                  Help us improve by letting us know why you're cancelling
                </p>
              </div>

              {/* Warning Notice */}
              <div className="bg-orange-50 border-l-4 border-orange-600 p-4 rounded">
                <p className="text-sm text-gray-800">
                  <strong>⚠️ Please note:</strong> Once cancelled, this time slot will be released
                  for other community members. You will need to make a new booking if you change your mind.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="festive-button-primary"
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="spinner" />
                      <span>Cancelling...</span>
                    </span>
                  ) : (
                    <>Cancel Booking</>
                  )}
                </button>
              </div>

              {/* Back Link */}
              <div className="text-center">
                <a
                  href="/"
                  className="text-festive-green hover:text-festive-forest transition-colors text-sm font-medium"
                >
                  ← Back to Home
                </a>
              </div>
            </form>
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
