import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { bookingSchema } from '@/lib/utils/validation';
import { generateBookingReference } from '@/lib/utils/booking-reference';
import { generateVerificationToken, generateTokenExpiration } from '@/lib/utils/verification-token';
import { sanitizePassengerName, sanitizeAddress, sanitizeSpecialRequirements } from '@/lib/utils/sanitize';
import { resend, FROM_EMAIL, ADMIN_EMAIL } from '@/lib/email/resend';
import { verificationEmailTemplate, passengerConfirmationTemplate, adminNotificationTemplate } from '@/lib/email/templates';
import { Booking } from '@/types';
import { withRateLimit } from '@/lib/rate-limit';
import {
  getClientIp,
  getUserAgent,
  validateRequestSize,
  validateHoneypot,
  extractRequestMetadata,
  addSecurityHeaders,
  addRateLimitHeaders,
} from '@/lib/security/request-validation';
import { checkRateLimit, checkDuplicateIpBooking } from '@/lib/security/ip-tracking';
import { validateSubmissionTiming, isValidFormLoadToken } from '@/lib/security/submission-timing';
import { securityLogger } from '@/lib/security/logger';

export async function POST(request: NextRequest) {
  // Apply rate limiting: 3 requests per hour per IP
  return withRateLimit(request, 'bookings', async () => {
    try {
      // Extract request metadata for security checks
      const { ip, userAgent, path } = extractRequestMetadata(request);

      // 1. Validate request size (prevent DoS attacks)
      const sizeValidation = await validateRequestSize(request);
      if (!sizeValidation.isValid) {
        return addSecurityHeaders(sizeValidation.error!);
      }

      // 2. Check additional rate limiting (more granular than global middleware)
      const rateLimitCheck = checkRateLimit(ip, path);
      if (!rateLimitCheck.allowed) {
        const response = NextResponse.json(
          {
            error: rateLimitCheck.message,
          },
          { status: 429 } // 429 Too Many Requests
        );
        addRateLimitHeaders(response, rateLimitCheck.limit, rateLimitCheck.remaining, rateLimitCheck.resetTime);
        return addSecurityHeaders(response);
      }

      // Parse request body
      const body = await request.json();

      // 3. Check honeypot field (bot detection)
      const honeypotCheck = validateHoneypot(body.honeypot, ip, userAgent);
      if (!honeypotCheck.isValid) {
        return addSecurityHeaders(honeypotCheck.error!);
      }

      // 4. Validate submission timing (detect suspiciously fast submissions)
      if (body.formLoadTime && isValidFormLoadToken(body.formLoadTime)) {
        const timingCheck = validateSubmissionTiming(body.formLoadTime, ip, userAgent);
        if (!timingCheck.isValid) {
          return addSecurityHeaders(
            NextResponse.json(
              {
                error: timingCheck.message,
              },
              { status: 400 }
            )
          );
        }
      }

      // 5. Check for duplicate bookings from same IP
      const duplicateCheck = await checkDuplicateIpBooking(ip);
      if (duplicateCheck.isDuplicate) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: duplicateCheck.message,
            },
            { status: 429 } // 429 Too Many Requests
          )
        );
      }

    // Validate request data with Zod
    const validationResult = bookingSchema.safeParse(body);

    if (!validationResult.success) {
      // Log validation failures for security monitoring
      securityLogger.logValidationFailure(
        ip,
        path,
        validationResult.error.flatten().fieldErrors,
        userAgent
      );

      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        )
      );
    }

    const data = validationResult.data;

    // Sanitize user inputs to prevent XSS and injection attacks
    const sanitizedData = {
      ...data,
      passenger_name: sanitizePassengerName(data.passenger_name),
      pickup_address: sanitizeAddress(data.pickup_address),
      destination_address: sanitizeAddress(data.destination_address),
      special_requirements: data.special_requirements
        ? sanitizeSpecialRequirements(data.special_requirements)
        : null,
    };

    const supabase = createServerClient();

    // Check if time slot is still available (race condition check)
    const { data: existingBooking } = await (supabase as any)
      .from('bookings')
      .select('id')
      .eq('time_slot', data.time_slot)
      .eq('status', 'confirmed')
      .single();

    if (existingBooking) {
      return NextResponse.json(
        {
          error: 'This time slot has just been booked by someone else. Please select another time.',
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Generate unique booking reference and verification token
    const bookingReference = generateBookingReference();
    const verificationToken = generateVerificationToken();
    const tokenExpiration = generateTokenExpiration();

    // Insert booking into database with sanitized data, pending status, and IP tracking
    const { data: booking, error: insertError } = await (supabase as any)
      .from('bookings')
      .insert({
        passenger_name: sanitizedData.passenger_name,
        passenger_phone: sanitizedData.passenger_phone,
        passenger_email: sanitizedData.passenger_email,
        time_slot: sanitizedData.time_slot,
        pickup_address: sanitizedData.pickup_address,
        destination_category: sanitizedData.destination_category,
        destination_address: sanitizedData.destination_address,
        num_passengers: sanitizedData.num_passengers,
        special_requirements: sanitizedData.special_requirements || null,
        booking_reference: bookingReference,
        status: 'pending',
        verification_token: verificationToken,
        verification_token_expires_at: tokenExpiration.toISOString(),
        ip_address: ip, // Store IP for duplicate detection and security tracking
        user_agent: userAgent, // Store user agent for security analysis
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);

      // Check if it's a unique constraint violation (race condition)
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            error: 'This time slot was just booked. Please select another time.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to create booking. Please try again.',
        },
        { status: 500 }
      );
    }

    // Send verification email (fire and forget - don't block response)
    sendVerificationEmail(booking as Booking).catch((error) => {
      console.error('Email sending error:', error);
      // Log error but don't fail the booking
    });

    // Return success response with pending status and security headers
      const response = NextResponse.json({
        success: true,
        message: 'Please check your email to verify your booking',
        booking: {
          id: booking.id,
          booking_reference: booking.booking_reference,
          passenger_name: booking.passenger_name,
          time_slot: booking.time_slot,
          status: 'pending',
        },
      });

      // Add rate limit headers to response
      addRateLimitHeaders(response, rateLimitCheck.limit, rateLimitCheck.remaining, rateLimitCheck.resetTime);
      return addSecurityHeaders(response);
    } catch (error) {
      console.error('Booking error:', error);
      return NextResponse.json(
        {
          error: 'An unexpected error occurred. Please try again.',
        },
        { status: 500 }
      );
    }
  });
}

/**
 * Send verification email to passenger
 */
async function sendVerificationEmail(booking: Booking) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: booking.passenger_email,
      subject: `🎄 Verify Your Festive Ride Booking - ${booking.booking_reference}`,
      html: verificationEmailTemplate(booking),
    });
  } catch (error) {
    // Re-throw to be caught by the caller
    throw error;
  }
}

/**
 * Send confirmation emails to passenger and admin (after verification)
 */
export async function sendBookingConfirmationEmails(booking: Booking) {
  try {
    // Send email to passenger
    await resend.emails.send({
      from: FROM_EMAIL,
      to: booking.passenger_email,
      subject: `🎄 Ride Confirmed - ${booking.booking_reference}`,
      html: passengerConfirmationTemplate(booking),
    });

    // Send email to admin
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Booking: ${booking.booking_reference} - ${booking.time_slot}`,
      html: adminNotificationTemplate(booking),
    });
  } catch (error) {
    // Re-throw to be caught by the caller
    throw error;
  }
}
