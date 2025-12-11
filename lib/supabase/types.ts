// Database types for Supabase
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string;
          created_at: string;
          passenger_name: string;
          passenger_phone: string;
          passenger_email: string;
          time_slot: string;
          pickup_address: string;
          destination_category: string;
          destination_address: string;
          num_passengers: number;
          special_requirements: string | null;
          booking_reference: string;
          status: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          passenger_name: string;
          passenger_phone: string;
          passenger_email: string;
          time_slot: string;
          pickup_address: string;
          destination_category: string;
          destination_address: string;
          num_passengers: number;
          special_requirements?: string | null;
          booking_reference: string;
          status?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          passenger_name?: string;
          passenger_phone?: string;
          passenger_email?: string;
          time_slot?: string;
          pickup_address?: string;
          destination_category?: string;
          destination_address?: string;
          num_passengers?: number;
          special_requirements?: string | null;
          booking_reference?: string;
          status?: string;
        };
      };
    };
  };
}
