-- Database migration for security enhancements
-- Add IP tracking and user agent fields to bookings table

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

-- Add comments to document the security columns
COMMENT ON COLUMN bookings.ip_address IS 'IP address of the booking requester (for duplicate detection and security tracking)';
COMMENT ON COLUMN bookings.user_agent IS 'User agent string of the booking requester (for security analysis)';

-- Optional: Create a view for security monitoring
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
