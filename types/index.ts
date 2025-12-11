// TypeScript type definitions for Festive Rides

export interface Booking {
  id: string;
  created_at: string;
  passenger_name: string;
  passenger_phone: string;
  passenger_email: string;
  time_slot: string;
  pickup_address: string;
  destination_category: DestinationCategory;
  destination_address: string;
  num_passengers: number;
  special_requirements?: string;
  booking_reference: string;
  status: BookingStatus;
}

export type DestinationCategory =
  | 'doctor'
  | 'church'
  | 'supermarket'
  | 'christmas-events'
  | 'whanau-visits'
  | 'other';

export type BookingStatus = 'confirmed' | 'cancelled';

export interface TimeSlot {
  time: string;
  label: string;
  value: string;
}

export interface SlotAvailability {
  [timeSlot: string]: {
    available: boolean;
    booked: boolean;
  };
}

export interface BookingFormData {
  passenger_name: string;
  passenger_phone: string;
  passenger_email: string;
  pickup_address: string;
  destination_category: DestinationCategory;
  destination_address: string;
  time_slot: string;
  num_passengers: number;
  special_requirements?: string;
}
