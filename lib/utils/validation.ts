import { z } from 'zod';
import { TIME_SLOT_VALUES } from './time-slots';

// New Zealand phone number regex (supports various formats)
// Examples: 021234567, 0212345678, +6421234567, +64212345678, 09123456, 091234567
const NZ_PHONE_REGEX = /^(?:\+?64|0)(?:[2-9]\d{7,9})$/;

// Destination categories
const DESTINATION_CATEGORIES = [
  'doctor',
  'church',
  'supermarket',
  'christmas-events',
  'whanau-visits',
  'other',
] as const;

// Booking form validation schema
export const bookingSchema = z.object({
  passenger_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name is too long')
    .trim(),

  passenger_phone: z
    .string()
    .regex(NZ_PHONE_REGEX, 'Please enter a valid NZ phone number (e.g., 021234567 or 091234567)')
    .trim(),

  passenger_email: z
    .string()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long')
    .toLowerCase()
    .trim(),

  pickup_address: z
    .string()
    .min(10, 'Please provide a complete pickup address')
    .max(500, 'Address is too long')
    .trim(),

  destination_category: z.enum(DESTINATION_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a destination type' }),
  }),

  destination_address: z
    .string()
    .min(5, 'Please provide a complete destination address')
    .max(500, 'Address is too long')
    .trim(),

  time_slot: z.enum(TIME_SLOT_VALUES as readonly [string, ...string[]], {
    errorMap: () => ({ message: 'Please select a valid time slot' }),
  }),

  num_passengers: z
    .number()
    .int('Number of passengers must be a whole number')
    .min(1, 'At least 1 passenger is required')
    .max(8, 'Maximum 8 passengers per ride'),

  special_requirements: z
    .string()
    .max(1000, 'Special requirements are too long')
    .trim()
    .optional()
    .or(z.literal('')),
});

export type BookingFormData = z.infer<typeof bookingSchema>;
