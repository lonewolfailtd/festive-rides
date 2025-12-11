# Email Verification System for Festive Rides

This document outlines the email verification system implemented to prevent fake email bookings.

## Overview

The email verification system ensures that all bookings are verified before being confirmed. This prevents spam, fake bookings, and ensures that only users with valid email addresses can book rides.

## How It Works

### Booking Flow

1. **User Submits Form**
   - Form data is validated
   - Booking is created with `status: 'pending'`
   - A unique verification token is generated (32 characters)
   - Token expiration is set to 24 hours from creation
   - Verification email is sent to the user

2. **User Receives Email**
   - Email contains booking details
   - Includes a verification link with the unique token
   - Explains that link expires in 24 hours

3. **User Clicks Verification Link**
   - User is redirected to `/verify/[token]`
   - System validates the token
   - Checks if token has expired
   - Verifies time slot is still available
   - Updates booking status to `confirmed`
   - Sends confirmation email to user and admin

4. **Slot Availability**
   - Only `confirmed` bookings count toward slot availability
   - Pending bookings temporarily reserve slots but don't block others if expired
   - Multiple pending bookings can exist for the same slot
   - First to verify gets the slot

## Files Created/Modified

### New Files

1. **`lib/utils/verification-token.ts`**
   - Token generation utilities
   - Token validation functions
   - Expiration checking

2. **`app/api/bookings/verify/[token]/route.ts`**
   - Verification API endpoint
   - Handles token validation
   - Updates booking status
   - Sends confirmation emails

3. **`app/verify/[token]/page.tsx`**
   - Verification page UI
   - Shows success/error states
   - Displays booking details after verification

4. **`app/booking-pending/page.tsx`**
   - Shown after initial booking submission
   - Instructs user to check email
   - Lists next steps

5. **`app/api/bookings/cleanup-expired/route.ts`**
   - Endpoint to cancel expired pending bookings
   - Should be called periodically via cron

6. **`supabase-email-verification-migration.sql`**
   - Database migration for verification fields
   - Adds indexes for performance
   - Includes cleanup function

### Modified Files

1. **`types/index.ts`**
   - Added `pending` to `BookingStatus`
   - Added verification fields to `Booking` interface

2. **`app/api/bookings/route.ts`**
   - Creates bookings with `pending` status
   - Generates verification tokens
   - Sends verification email instead of confirmation

3. **`lib/email/templates.ts`**
   - Added `verificationEmailTemplate()`
   - Kept `passengerConfirmationTemplate()` for post-verification

4. **`components/BookingForm/BookingForm.tsx`**
   - Updated success message
   - Redirects to pending page instead of confirmation

5. **`app/api/bookings/check-availability/route.ts`**
   - Already only counts `confirmed` bookings (no changes needed)

## Database Schema Changes

Run `supabase-email-verification-migration.sql` to add:

```sql
-- New columns
verification_token VARCHAR(32)
verification_token_expires_at TIMESTAMP WITH TIME ZONE
verified_at TIMESTAMP WITH TIME ZONE

-- Updated status values
status CHECK (status IN ('pending', 'confirmed', 'cancelled'))

-- New indexes
idx_bookings_verification_token
idx_bookings_pending_expired
unique_confirmed_time_slot (partial index)
```

## Environment Variables

Add to `.env.local`:

```env
# Required for email sending (already set)
RESEND_API_KEY=re_...
ADMIN_EMAIL=sammipetersen1720@yahoo.co.nz

# Required for cleanup endpoint
CLEANUP_API_KEY=your-secret-key-here

# Required for verification links
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Periodic Cleanup

### Option 1: Supabase pg_cron (Recommended)

If you have the `pg_cron` extension enabled in Supabase:

```sql
SELECT cron.schedule(
  'cancel-expired-bookings',
  '*/30 * * * *',  -- Every 30 minutes
  'SELECT cancel_expired_pending_bookings()'
);
```

### Option 2: External Cron Job

Set up a cron job to call the cleanup endpoint:

```bash
# Every 30 minutes
*/30 * * * * curl -X POST https://your-domain.com/api/bookings/cleanup-expired \
  -H "x-api-key: your-secret-key-here"
```

### Option 3: Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/bookings/cleanup-expired",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

Then update the endpoint to check for Vercel's cron secret.

## Security Features

1. **Token Format Validation**
   - 32-character alphanumeric tokens
   - URL-safe characters only

2. **Token Expiration**
   - 24-hour validity period
   - Automatic cleanup of expired bookings

3. **Race Condition Protection**
   - Double-checks slot availability during verification
   - Prevents multiple confirmations for same slot

4. **Email Verification**
   - Confirms user owns the email address
   - Prevents fake email submissions

## User Experience

### Success Flow
1. Submit form → "Please check your email"
2. Click verification link → "Booking Verified!"
3. Receive confirmation email

### Error Scenarios

- **Expired Token**: "Link expired. Please book again."
- **Already Verified**: "Already verified" (with booking details)
- **Slot Taken**: "Time slot taken. Please book another time."
- **Invalid Token**: "Invalid verification link"

## Testing

### Test Verification Flow

1. Create a booking through the form
2. Check your email for verification link
3. Click the link
4. Verify you see success page
5. Check for confirmation email

### Test Expiration

1. Create a booking
2. Manually update `verification_token_expires_at` in database to past time
3. Try to verify - should show expired error

### Test Cleanup Endpoint

```bash
curl -X POST http://localhost:3000/api/bookings/cleanup-expired \
  -H "x-api-key: your-secret-key"
```

## Monitoring

Key metrics to monitor:

1. **Verification Rate**: % of bookings that get verified
2. **Expired Bookings**: How many bookings expire unverified
3. **Time to Verification**: How long users take to verify
4. **Failed Verifications**: Track error types

## Future Enhancements

1. **Resend Verification Email**
   - Add endpoint to resend verification email
   - Rate limit to prevent abuse

2. **Email Reminders**
   - Send reminder email after 12 hours if not verified

3. **Admin Dashboard**
   - View pending vs confirmed bookings
   - Manually verify bookings if needed

4. **Analytics**
   - Track verification funnel
   - Identify drop-off points

## Rollback Plan

If you need to disable email verification:

1. Update `app/api/bookings/route.ts`:
   - Change `status: 'pending'` to `status: 'confirmed'`
   - Remove verification token generation
   - Send confirmation email directly

2. Slot availability already filters by confirmed status, so no changes needed there

3. Database changes are additive, so they won't break anything if unused

## Support

For issues or questions:
- Email: sammipetersen1720@yahoo.co.nz
- Check logs in Supabase dashboard
- Review verification endpoint errors in browser console
