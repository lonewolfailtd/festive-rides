'use client';

import { TIME_SLOTS } from '@/lib/utils/time-slots';
import { SlotAvailability } from '@/types';
import { clsx } from 'clsx';

interface TimeSlotSelectorProps {
  slots: SlotAvailability | null;
  selected: string | null;
  onChange: (slot: string) => void;
  error?: string;
}

export function TimeSlotSelector({
  slots,
  selected,
  onChange,
  error,
}: TimeSlotSelectorProps) {
  return (
    <div className="form-field">
      <label className="festive-label">
        Select Your Ride Time <span className="text-festive-red">*</span>
      </label>

      {!slots && (
        <div className="text-center py-8">
          <div className="spinner mx-auto mb-2" />
          <p className="text-gray-600">Loading available time slots...</p>
        </div>
      )}

      {slots && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {TIME_SLOTS.map((slot) => {
            const slotInfo = slots[slot.time];
            const isBooked = slotInfo?.booked;
            const isSelected = selected === slot.time;

            return (
              <button
                key={slot.time}
                type="button"
                disabled={isBooked}
                onClick={() => !isBooked && onChange(slot.time)}
                className={clsx(
                  'relative p-4 rounded-lg border-2 transition-all',
                  'text-lg font-semibold min-h-[80px]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2',
                  isBooked &&
                    'bg-red-100 border-red-300 cursor-not-allowed opacity-60',
                  !isBooked &&
                    !isSelected &&
                    'bg-green-50 border-green-400 hover:border-green-600 hover:shadow-md',
                  isSelected &&
                    'bg-amber-100 border-amber-500 ring-4 ring-amber-300 glow'
                )}
                aria-label={`${slot.label} ${isBooked ? '(Fully Booked)' : isSelected ? '(Selected)' : '(Available)'}`}
                aria-pressed={isSelected}
              >
                {/* Strike-through effect for booked slots */}
                {isBooked && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <div className="w-full h-1 bg-red-500 transform rotate-12" />
                  </div>
                )}

                <div className={isBooked ? 'line-through' : ''}>
                  {slot.label}
                </div>

                {isBooked && (
                  <span className="text-xs text-red-700 block mt-1 font-normal">
                    Fully Booked
                  </span>
                )}

                {isSelected && !isBooked && (
                  <span className="text-xs text-amber-700 block mt-1 font-normal">
                    ✓ Selected
                  </span>
                )}

                {!isBooked && !isSelected && (
                  <span className="text-xs text-green-700 block mt-1 font-normal available-pulse">
                    ● Available
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="error-message" role="alert">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
