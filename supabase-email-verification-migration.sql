-- Email Verification Migration for Festive Rides
-- Run this SQL in your Supabase SQL Editor to add email verification fields

-- Add verification fields to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(32),
  ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Update status constraint to include 'pending'
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled'));

-- Change default status to 'pending'
ALTER TABLE bookings
  ALTER COLUMN status SET DEFAULT 'pending';

-- Update unique constraint to allow multiple pending bookings per time slot
-- Only confirmed bookings should enforce time slot uniqueness
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS unique_time_slot;

-- Create partial unique index for confirmed bookings only
CREATE UNIQUE INDEX IF NOT EXISTS unique_confirmed_time_slot
  ON bookings(time_slot)
  WHERE status = 'confirmed';

-- Create index on verification token for fast lookups
CREATE INDEX IF NOT EXISTS idx_bookings_verification_token
  ON bookings(verification_token)
  WHERE verification_token IS NOT NULL;

-- Create index for cleaning up expired pending bookings
CREATE INDEX IF NOT EXISTS idx_bookings_pending_expired
  ON bookings(verification_token_expires_at, status)
  WHERE status = 'pending';

-- Update existing index
DROP INDEX IF EXISTS idx_bookings_time_slot;
CREATE INDEX IF NOT EXISTS idx_bookings_time_slot
  ON bookings(time_slot, status);

-- Add comments for new fields
COMMENT ON COLUMN bookings.verification_token IS 'Unique token for email verification (32 characters)';
COMMENT ON COLUMN bookings.verification_token_expires_at IS 'Expiration timestamp for verification token (24 hours from creation)';
COMMENT ON COLUMN bookings.verified_at IS 'Timestamp when email was verified and booking confirmed';

-- Function to automatically cancel expired pending bookings
CREATE OR REPLACE FUNCTION cancel_expired_pending_bookings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE bookings
  SET status = 'cancelled'
  WHERE status = 'pending'
    AND verification_token_expires_at < NOW();
END;
$$;

-- Create a scheduled job to run cleanup (if using pg_cron extension)
-- Note: This requires the pg_cron extension to be enabled
-- If you don't have pg_cron, you can call this function manually or via a cron job
-- SELECT cron.schedule('cancel-expired-bookings', '*/30 * * * *', 'SELECT cancel_expired_pending_bookings()');

COMMENT ON FUNCTION cancel_expired_pending_bookings IS 'Automatically cancels pending bookings with expired verification tokens';

-- Optional: Migrate existing confirmed bookings to have verified_at timestamp
-- Uncomment if you want to set verified_at for existing bookings
-- UPDATE bookings
-- SET verified_at = created_at
-- WHERE status = 'confirmed' AND verified_at IS NULL;
