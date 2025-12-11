-- Complete Security Migration for Festive Rides
-- Run this SQL in your Supabase SQL Editor
-- This combines email verification and security tracking features

-- ===================================================================
-- PART 1: Email Verification Fields
-- ===================================================================

-- Add verification fields to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP WITH TIME ZONE,
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
  ON bookings(verification_expires_at, status)
  WHERE status = 'pending';

-- Update existing index
DROP INDEX IF EXISTS idx_bookings_time_slot;
CREATE INDEX IF NOT EXISTS idx_bookings_time_slot
  ON bookings(time_slot, status);

-- ===================================================================
-- PART 2: Security Tracking Fields
-- ===================================================================

-- Add ip_address column for tracking duplicate bookings and security analysis
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Add user_agent column for security analysis and bot detection
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create index on ip_address and created_at for efficient duplicate checking
CREATE INDEX IF NOT EXISTS idx_bookings_ip_created
ON bookings(ip_address, created_at)
WHERE status = 'confirmed';

-- Create index on ip_address alone for security queries
CREATE INDEX IF NOT EXISTS idx_bookings_ip
ON bookings(ip_address);

-- ===================================================================
-- PART 3: Comments and Documentation
-- ===================================================================

COMMENT ON COLUMN bookings.verification_token IS 'Unique token for email verification (64 characters)';
COMMENT ON COLUMN bookings.verification_expires_at IS 'Expiration timestamp for verification token (24 hours from creation)';
COMMENT ON COLUMN bookings.verified_at IS 'Timestamp when email was verified and booking confirmed';
COMMENT ON COLUMN bookings.ip_address IS 'IP address of the booking requester (for duplicate detection and security tracking)';
COMMENT ON COLUMN bookings.user_agent IS 'User agent string of the booking requester (for security analysis)';

-- ===================================================================
-- PART 4: Helper Functions
-- ===================================================================

-- Function to automatically cancel expired pending bookings
CREATE OR REPLACE FUNCTION cancel_expired_pending_bookings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE bookings
  SET status = 'cancelled'
  WHERE status = 'pending'
    AND verification_expires_at < NOW();
END;
$$;

COMMENT ON FUNCTION cancel_expired_pending_bookings IS 'Automatically cancels pending bookings with expired verification tokens';

-- ===================================================================
-- PART 5: Security Monitoring View
-- ===================================================================

-- Create a view for security monitoring
CREATE OR REPLACE VIEW booking_security_stats AS
SELECT
  ip_address,
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_bookings,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
  MIN(created_at) as first_booking,
  MAX(created_at) as last_booking,
  ARRAY_AGG(DISTINCT user_agent) as user_agents
FROM bookings
WHERE ip_address IS NOT NULL
GROUP BY ip_address
HAVING COUNT(*) > 1  -- Only show IPs with multiple bookings
ORDER BY total_bookings DESC;

COMMENT ON VIEW booking_security_stats IS 'Security monitoring view showing booking patterns by IP address';

-- ===================================================================
-- MIGRATION COMPLETE
-- ===================================================================
