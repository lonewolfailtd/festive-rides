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
        Select Your Ride Time <span className="text-[var(--color-burgundy)]">*</span>
      </label>

      {!slots && (
        <div className="text-center py-8">
          <div className="spinner mx-auto mb-2" style={{ borderTopColor: 'var(--color-terracotta)' }} />
          <p className="text-[var(--color-taupe)]">Loading available time slots...</p>
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
                  'slot-button relative min-h-[85px] flex flex-col items-center justify-center gap-1',
                  isBooked && 'opacity-40 cursor-not-allowed bg-gray-100',
                  isSelected && 'selected'
                )}
                aria-label={`${slot.label} ${isBooked ? '(Fully Booked)' : isSelected ? '(Selected)' : '(Available)'}`}
                aria-pressed={isSelected}
              >
                {/* Time display */}
                <div className={clsx(
                  'text-lg font-bold',
                  isBooked && 'line-through'
                )}>
                  {slot.label}
                </div>

                {/* Status indicator */}
                {isBooked && (
                  <span className="text-xs text-[var(--color-burgundy)] font-semibold">
                    Fully Booked
                  </span>
                )}

                {isSelected && !isBooked && (
                  <span className="text-xs font-semibold">
                    Selected
                  </span>
                )}

                {!isBooked && !isSelected && (
                  <span className="text-xs text-[var(--color-sage)] font-semibold available-pulse">
                    Available
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
