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
        Where are you going? <span className="text-festive-red">*</span>
      </label>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DESTINATIONS.map((dest) => (
          <button
            key={dest.value}
            type="button"
            onClick={() => onChange(dest.value)}
            className={clsx(
              'p-4 rounded-lg border-2 transition-all',
              'flex flex-col items-center gap-2',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              'hover:shadow-md min-h-[100px]',
              selected === dest.value
                ? 'bg-green-100 border-green-500 ring-2 ring-green-300'
                : 'bg-white border-gray-300 hover:border-green-400'
            )}
            aria-label={`${dest.label}${selected === dest.value ? ' (Selected)' : ''}`}
            aria-pressed={selected === dest.value}
          >
            <span className="text-4xl" aria-hidden="true">
              {dest.icon}
            </span>
            <span className="text-sm font-medium text-center">
              {dest.label}
            </span>
            {selected === dest.value && (
              <span className="text-xs text-green-700">✓ Selected</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="error-message" role="alert">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
