import { NextRequest, NextResponse } from 'next/server';
import { convexServerClient } from '@/lib/convex/server';
import { api } from '@/convex/_generated/api';
import { bookingSchema } from '@/lib/utils/validation';
import { generateBookingReference } from '@/lib/utils/booking-reference';
import { generateVerificationToken, generateTokenExpiration } from '@/lib/utils/verification-token';
import { sanitizePassengerName, sanitizeAddress, sanitizeSpecialRequirements } from '@/lib/utils/sanitize';
import { resend, FROM_EMAIL, ADMIN_EMAIL } from '@/lib/email/resend';
import { verificationEmailTemplate, passengerConfirmationTemplate, adminNotificationTemplate } from '@/lib/email/templates';
import { Booking } from '@/types';
import { withRateLimit } from '@/lib/rate-limit';
import {
  validateRequestSize,
  validateHoneypot,
  extractRequestMetadata,
  addSecurityHeaders,
  addRateLimitHeaders,
} from '@/lib/security/request-validation';
import { checkRateLimit, checkDuplicateIpBooking } from '@/lib/security/ip-tracking';
import { validateSubmissionTiming, isValidFormLoadToken } from '@/lib/security/submission-timing';
import { securityLogger } from '@/lib/security/logger';

/**
 * Convert a Convex bookings document (camelCase) into the legacy snake_case
 * `Booking` shape consumed by the email templates and existing types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convexBookingToLegacy(doc: any): Booking {
  return {
    id: doc._id,
    created_at: new Date(doc._creationTime).toISOString(),
    passenger_name: doc.passengerName,
    passenger_phone: doc.passengerPhone,
    passenger_email: doc.passengerEmail,
    time_slot: doc.timeSlot,
    pickup_address: doc.pickupAddress,
    destination_category: doc.destinationCategory,
    destination_address: doc.destinationAddress,
    num_passengers: doc.numPassengers,
    special_requirements: doc.specialRequirements,
    booking_reference: doc.bookingReference,
    status: doc.status,
    verification_token: doc.verificationToken,
    verification_token_expires_at:
      typeof doc.verificationTokenExpiresAt === 'number'
        ? new Date(doc.verificationTokenExpiresAt).toISOString()
        : undefined,
    verified_at:
      typeof doc.verifiedAt === 'number'
        ? new Date(doc.verifiedAt).toISOString()
        : undefined,
  };
}

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

      // Generate unique booking reference and verification token
      const bookingReference = generateBookingReference();
      const verificationToken = generateVerificationToken();
      const tokenExpiration = generateTokenExpiration();

      // Create pending booking via Convex. The mutation handles slot-availability,
      // reference uniqueness, and token-collision checks atomically.
      let createdDoc;
      try {
        createdDoc = await convexServerClient.mutation(api.bookings.createPending, {
          passengerName: sanitizedData.passenger_name,
          passengerPhone: sanitizedData.passenger_phone,
          passengerEmail: sanitizedData.passenger_email,
          timeSlot: sanitizedData.time_slot,
          pickupAddress: sanitizedData.pickup_address,
          destinationCategory: sanitizedData.destination_category,
          destinationAddress: sanitizedData.destination_address,
          numPassengers: sanitizedData.num_passengers,
          specialRequirements: sanitizedData.special_requirements || undefined,
          bookingReference,
          verificationToken,
          verificationTokenExpiresAt: tokenExpiration.getTime(),
          ipAddress: ip || undefined,
          userAgent: userAgent || undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Convex createPending error:', message);

        if (/time slot/i.test(message)) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'This time slot has just been booked by someone else. Please select another time.' },
              { status: 409 }
            )
          );
        }
        if (/reference already exists|token collision/i.test(message)) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'A booking conflict occurred. Please try again.' },
              { status: 409 }
            )
          );
        }
        if (/invalid/i.test(message)) {
          return addSecurityHeaders(
            NextResponse.json({ error: message }, { status: 400 })
          );
        }
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to create booking. Please try again.' },
            { status: 500 }
          )
        );
      }

      const booking = convexBookingToLegacy(createdDoc);

      // Send verification email (fire and forget - don't block response)
      sendVerificationEmail(booking).catch((error) => {
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
  await resend.emails.send({
    from: FROM_EMAIL,
    to: booking.passenger_email,
    subject: `🎄 Verify Your Festive Ride Booking - ${booking.booking_reference}`,
    html: verificationEmailTemplate(booking),
  });
}

/**
 * Send confirmation emails to passenger and admin (after verification)
 */
export async function sendBookingConfirmationEmails(booking: Booking) {
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
}
