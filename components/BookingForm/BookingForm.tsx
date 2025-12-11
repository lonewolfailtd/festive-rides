'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { bookingSchema, BookingFormData } from '@/lib/utils/validation';
import { TimeSlotSelector } from './TimeSlotSelector';
import { DestinationButtons } from './DestinationButtons';
import { useSlotAvailability } from '@/hooks/useSlotAvailability';
import { DestinationCategory } from '@/types';

export function BookingForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { slots, totalAvailable } = useSlotAvailability(10000);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      num_passengers: 1,
      time_slot: '',
      destination_category: undefined,
      special_requirements: '',
    },
  });

  // Watch form values for controlled components
  const timeSlot = watch('time_slot');
  const destinationCategory = watch('destination_category');

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Time slot conflict
          toast.error(result.error || 'This time slot is no longer available');
        } else if (response.status === 400) {
          // Validation error
          toast.error('Please check your form and try again');
        } else {
          // Other errors
          toast.error(result.error || 'Failed to create booking');
        }
        return;
      }

      // Success - redirect to confirmation page
      toast.success('Booking confirmed!');
      router.push(`/confirmation?ref=${result.booking.booking_reference}`);
    } catch (error) {
      console.error('Booking submission error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Availability Banner */}
      {slots && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 text-center">
          <p className="text-lg font-semibold text-amber-900">
            {totalAvailable > 0 ? (
              <>
                <span className="text-2xl">🎉</span> {totalAvailable} time{' '}
                {totalAvailable === 1 ? 'slot' : 'slots'} still available!
              </>
            ) : (
              <>
                <span className="text-2xl">😔</span> All time slots are fully
                booked
              </>
            )}
          </p>
        </div>
      )}

      {/* Passenger Name */}
      <div className="form-field">
        <label htmlFor="passenger_name" className="festive-label">
          Your Full Name <span className="text-festive-red">*</span>
        </label>
        <input
          id="passenger_name"
          type="text"
          className="festive-input"
          placeholder="e.g., John Smith"
          {...register('passenger_name')}
          aria-invalid={errors.passenger_name ? 'true' : 'false'}
          aria-describedby={
            errors.passenger_name ? 'passenger_name-error' : undefined
          }
        />
        {errors.passenger_name && (
          <p id="passenger_name-error" className="error-message" role="alert">
            ⚠ {errors.passenger_name.message}
          </p>
        )}
      </div>

      {/* Passenger Phone */}
      <div className="form-field">
        <label htmlFor="passenger_phone" className="festive-label">
          Phone Number <span className="text-festive-red">*</span>
        </label>
        <input
          id="passenger_phone"
          type="tel"
          className="festive-input"
          placeholder="e.g., 021234567 or 091234567"
          {...register('passenger_phone')}
          aria-invalid={errors.passenger_phone ? 'true' : 'false'}
          aria-describedby={
            errors.passenger_phone ? 'passenger_phone-error' : undefined
          }
        />
        {errors.passenger_phone && (
          <p id="passenger_phone-error" className="error-message" role="alert">
            ⚠ {errors.passenger_phone.message}
          </p>
        )}
      </div>

      {/* Passenger Email */}
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
            ⚠ {errors.passenger_email.message}
          </p>
        )}
      </div>

      {/* Time Slot Selector */}
      <TimeSlotSelector
        slots={slots}
        selected={timeSlot}
        onChange={(slot) => setValue('time_slot', slot, { shouldValidate: true })}
        error={errors.time_slot?.message}
      />

      {/* Destination Category */}
      <DestinationButtons
        selected={destinationCategory as DestinationCategory | null}
        onChange={(dest) =>
          setValue('destination_category', dest, { shouldValidate: true })
        }
        error={errors.destination_category?.message}
      />

      {/* Pickup Address */}
      <div className="form-field">
        <label htmlFor="pickup_address" className="festive-label">
          Pickup Address <span className="text-festive-red">*</span>
        </label>
        <textarea
          id="pickup_address"
          className="festive-textarea"
          placeholder="Enter your full street address, suburb, and postcode"
          rows={3}
          {...register('pickup_address')}
          aria-invalid={errors.pickup_address ? 'true' : 'false'}
          aria-describedby={
            errors.pickup_address ? 'pickup_address-error' : undefined
          }
        />
        {errors.pickup_address && (
          <p id="pickup_address-error" className="error-message" role="alert">
            ⚠ {errors.pickup_address.message}
          </p>
        )}
      </div>

      {/* Destination Address */}
      <div className="form-field">
        <label htmlFor="destination_address" className="festive-label">
          Destination Address <span className="text-festive-red">*</span>
        </label>
        <textarea
          id="destination_address"
          className="festive-textarea"
          placeholder="Enter the full destination address, suburb, and postcode"
          rows={3}
          {...register('destination_address')}
          aria-invalid={errors.destination_address ? 'true' : 'false'}
          aria-describedby={
            errors.destination_address ? 'destination_address-error' : undefined
          }
        />
        {errors.destination_address && (
          <p
            id="destination_address-error"
            className="error-message"
            role="alert"
          >
            ⚠ {errors.destination_address.message}
          </p>
        )}
      </div>

      {/* Number of Passengers */}
      <div className="form-field">
        <label htmlFor="num_passengers" className="festive-label">
          Number of Passengers <span className="text-festive-red">*</span>
        </label>
        <input
          id="num_passengers"
          type="number"
          min="1"
          max="8"
          className="festive-input"
          {...register('num_passengers', { valueAsNumber: true })}
          aria-invalid={errors.num_passengers ? 'true' : 'false'}
          aria-describedby={
            errors.num_passengers ? 'num_passengers-error' : undefined
          }
        />
        <p className="text-sm text-gray-600 mt-1">
          Maximum 8 passengers per ride
        </p>
        {errors.num_passengers && (
          <p id="num_passengers-error" className="error-message" role="alert">
            ⚠ {errors.num_passengers.message}
          </p>
        )}
      </div>

      {/* Special Requirements */}
      <div className="form-field">
        <label htmlFor="special_requirements" className="festive-label">
          Special Requirements <span className="text-gray-500">(Optional)</span>
        </label>
        <textarea
          id="special_requirements"
          className="festive-textarea"
          placeholder="e.g., wheelchair access, child seat needed, assistance required"
          rows={3}
          {...register('special_requirements')}
          aria-invalid={errors.special_requirements ? 'true' : 'false'}
          aria-describedby={
            errors.special_requirements
              ? 'special_requirements-error'
              : undefined
          }
        />
        {errors.special_requirements && (
          <p
            id="special_requirements-error"
            className="error-message"
            role="alert"
          >
            ⚠ {errors.special_requirements.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting || totalAvailable === 0}
          className="festive-button-primary"
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner" />
              <span>Booking Your Ride...</span>
            </span>
          ) : (
            <>Book Your Festive Ride</>
          )}
        </button>
      </div>

      {/* Terms Notice */}
      <p className="text-sm text-gray-600 text-center">
        By booking, you agree to our service terms. You will receive a
        confirmation email with your booking reference.
      </p>
    </form>
  );
}
