import { TimeSlot } from '@/types';

// Service date - December 13, 2025
export const SERVICE_DATE = '2025-12-13';

// Time slots spread throughout the day with buffer time
export const TIME_SLOTS: readonly TimeSlot[] = [
  { time: '09:00', label: '9:00 AM', value: '09:00:00' },
  { time: '10:30', label: '10:30 AM', value: '10:30:00' },
  { time: '12:00', label: '12:00 PM (Noon)', value: '12:00:00' },
  { time: '13:30', label: '1:30 PM', value: '13:30:00' },
  { time: '15:00', label: '3:00 PM', value: '15:00:00' },
  { time: '16:30', label: '4:30 PM', value: '16:30:00' },
] as const;

// Extract just the time values for validation
export const TIME_SLOT_VALUES = TIME_SLOTS.map((slot) => slot.time) as readonly string[];

// Format time slot for display
export function formatTimeSlot(timeSlot: string): string {
  const slot = TIME_SLOTS.find((s) => s.time === timeSlot);
  return slot ? slot.label : timeSlot;
}

// Check if a time slot is valid
export function isValidTimeSlot(timeSlot: string): boolean {
  return TIME_SLOT_VALUES.includes(timeSlot);
}
