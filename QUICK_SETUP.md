# Quick Setup Guide - Email Verification

Follow these steps to activate the email verification system:

## Step 1: Database Migration (5 minutes)

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase-email-verification-migration.sql`
5. Paste into the editor
6. Click **Run**
7. Verify success message

**Verify Migration**:
```sql
-- Run this to check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('verification_token', 'verification_token_expires_at', 'verified_at');
```

Should return 3 rows.

## Step 2: Environment Variable (2 minutes)

1. Generate a secure API key:
   ```bash
   # On Mac/Linux:
   openssl rand -base64 32

   # On Windows (PowerShell):
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

   # Or use any random string generator
   ```

2. Add to `.env.local`:
   ```bash
   CLEANUP_API_KEY=your-generated-key-here
   ```

3. If deploying to Vercel/production, add the same variable there

## Step 3: Set Up Cleanup Cron Job (5 minutes)

Choose one option:

### Option A: Vercel Cron (Easiest for Vercel)

1. Create `vercel.json` in project root (or update existing):
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

2. Add to `.env` on Vercel dashboard:
   - Name: `CLEANUP_API_KEY`
   - Value: (your generated key)

3. The cron will automatically authenticate using Vercel's system

### Option B: External Cron Service

1. Sign up at https://cron-job.org (free)
2. Create new cron job:
   - **URL**: `https://your-domain.com/api/bookings/cleanup-expired`
   - **Schedule**: `*/30 * * * *` (every 30 minutes)
   - **Method**: POST
   - **Headers**: Add `x-api-key: your-cleanup-api-key`

### Option C: Supabase pg_cron (If Available)

If you have pg_cron extension:

```sql
SELECT cron.schedule(
  'cancel-expired-bookings',
  '*/30 * * * *',
  'SELECT cancel_expired_pending_bookings()'
);
```

## Step 4: Deploy & Test (10 minutes)

1. **Deploy the code**:
   ```bash
   git add .
   git commit -m "Add email verification system"
   git push
   ```

2. **Test the flow**:
   - Go to your booking form
   - Fill out and submit
   - Check your email for verification link
   - Click the link
   - Verify you see success page
   - Check for confirmation email

3. **Test cleanup** (manual):
   ```bash
   curl -X POST https://your-domain.com/api/bookings/cleanup-expired \
     -H "x-api-key: your-cleanup-api-key"
   ```

   Should return: `{"success":true,"cancelled_count":0,...}`

## Step 5: Verify Everything Works

### Checklist

- [ ] Database migration completed successfully
- [ ] CLEANUP_API_KEY added to environment
- [ ] Cron job configured and running
- [ ] Test booking creates pending status
- [ ] Verification email received
- [ ] Verification link works
- [ ] Status changes to confirmed
- [ ] Confirmation email sent
- [ ] Cleanup endpoint responds correctly

## Troubleshooting

### "Column does not exist" Error
→ Database migration not run. Go to Step 1.

### No verification email received
1. Check Resend dashboard for errors
2. Verify RESEND_API_KEY is set
3. Check spam folder
4. Check email address was entered correctly

### Verification link shows 404
→ Make sure code is deployed. The route is `/verify/[token]`

### Cleanup endpoint returns 401
→ Check CLEANUP_API_KEY matches in environment and request header

### Cron job not running
- **Vercel**: Check "Cron" tab in dashboard, verify `vercel.json` is correct
- **External**: Check cron-job.org dashboard for execution logs

## Configuration Options

You can customize these in `.env.local`:

```bash
# Token expiration time (modify in code)
# Default: 24 hours
# File: lib/utils/verification-token.ts
# Line: expiration.setHours(expiration.getHours() + 24);

# Cleanup frequency
# Recommended: Every 30 minutes
# Can be: */30 * * * * (30 min), */60 * * * * (hourly), 0 */6 * * * (6 hours)

# Minimum form submission time (bot detection)
MIN_FORM_SUBMISSION_TIME_MS=3000
```

## Monitoring

After setup, monitor these metrics:

1. **Pending bookings** - Check Supabase dashboard:
   ```sql
   SELECT COUNT(*) FROM bookings WHERE status = 'pending';
   ```

2. **Verification rate**:
   ```sql
   SELECT
     COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed,
     COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
     COUNT(CASE WHEN status = 'cancelled' AND verified_at IS NULL THEN 1 END) AS expired
   FROM bookings
   WHERE created_at > NOW() - INTERVAL '7 days';
   ```

3. **Email delivery** - Check Resend dashboard

## Next Steps

Once everything is working:

1. Monitor the first few bookings closely
2. Check email delivery rates in Resend
3. Verify cleanup cron is running (check for cancelled bookings)
4. Consider adding analytics tracking

## Need Help?

- Read: `EMAIL_VERIFICATION_README.md` for detailed documentation
- Read: `IMPLEMENTATION_SUMMARY.md` for technical overview
- Email: sammipetersen1720@yahoo.co.nz

## Rollback

If you need to disable verification quickly:

1. In `app/api/bookings/route.ts`, change line 83:
   ```typescript
   status: 'confirmed',  // was: 'pending'
   ```

2. Comment out lines 84-85 (verification token generation)

3. Change line 112 to use `sendBookingConfirmationEmails` instead of `sendVerificationEmail`

4. Redeploy

The system will work as before without verification.

---

**Estimated Total Setup Time**: 20-30 minutes

**Once setup is complete, the system runs automatically!**
