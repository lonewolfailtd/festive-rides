-- Festive Rides Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Passenger Information
  passenger_name VARCHAR(255) NOT NULL,
  passenger_phone VARCHAR(50) NOT NULL,
  passenger_email VARCHAR(255) NOT NULL,

  -- Booking Details
  time_slot TIME NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_category VARCHAR(100) NOT NULL,
  destination_address TEXT NOT NULL,
  num_passengers INTEGER NOT NULL DEFAULT 1 CHECK (num_passengers > 0 AND num_passengers <= 8),

  -- Special Requirements
  special_requirements TEXT,

  -- Booking Reference
  booking_reference VARCHAR(10) UNIQUE NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),

  -- Unique constraint to prevent double-booking (one booking per time slot)
  CONSTRAINT unique_time_slot UNIQUE (time_slot, status)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_time_slot ON bookings(time_slot, status) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Allow public to insert bookings
CREATE POLICY "Allow public inserts" ON bookings
  FOR INSERT WITH CHECK (true);

-- Allow public to read all bookings (for availability checking)
CREATE POLICY "Allow public to read bookings" ON bookings
  FOR SELECT USING (true);

-- No updates or deletes from public (only through admin dashboard in future)
CREATE POLICY "Prevent public updates" ON bookings
  FOR UPDATE USING (false);

CREATE POLICY "Prevent public deletes" ON bookings
  FOR DELETE USING (false);

-- Add comments for documentation
COMMENT ON TABLE bookings IS 'Festive Rides booking records for December 13, 2025';
COMMENT ON COLUMN bookings.time_slot IS 'Time slot for the ride (09:00, 10:30, 12:00, 13:30, 15:00, 16:30)';
COMMENT ON COLUMN bookings.booking_reference IS 'Unique booking reference (e.g., FR-ABC123)';
COMMENT ON CONSTRAINT unique_time_slot ON bookings IS 'Ensures only one confirmed booking per time slot';
