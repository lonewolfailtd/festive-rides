'use client';

import { DestinationCategory } from '@/types';
import { clsx } from 'clsx';

interface DestinationButtonsProps {
  selected: DestinationCategory | null;
  onChange: (destination: DestinationCategory) => void;
  error?: string;
}

const DESTINATIONS: Array<{
  value: DestinationCategory;
  label: string;
  icon: string;
}> = [
  { value: 'doctor', label: 'Doctor/Specialist', icon: '🏥' },
  { value: 'church', label: 'Church', icon: '⛪' },
  { value: 'supermarket', label: 'Supermarket', icon: '🛒' },
  { value: 'christmas-events', label: 'Christmas Events', icon: '🎄' },
  { value: 'whanau-visits', label: 'Whānau Visits', icon: '👨‍👩‍👧‍👦' },
  { value: 'other', label: 'Other', icon: '📍' },
];

export function DestinationButtons({
  selected,
  onChange,
  error,
}: DestinationButtonsProps) {
  return (
    <div className="form-field">
      <label className="festive-label">
        Where are you going? <span className="text-[var(--color-burgundy)]">*</span>
      </label>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {DESTINATIONS.map((dest) => (
          <button
            key={dest.value}
            type="button"
            onClick={() => onChange(dest.value)}
            className={clsx(
              'destination-button',
              'flex flex-col items-center gap-1 sm:gap-2 min-h-[95px] sm:min-h-[105px] justify-center px-2',
              selected === dest.value && 'selected'
            )}
            aria-label={`${dest.label}${selected === dest.value ? ' (Selected)' : ''}`}
            aria-pressed={selected === dest.value}
          >
            <span className="text-2xl sm:text-3xl" aria-hidden="true">
              {dest.icon}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-center leading-tight">
              {dest.label}
            </span>
            {selected === dest.value && (
              <span className="text-[10px] sm:text-xs font-semibold">
                Selected
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
