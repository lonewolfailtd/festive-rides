import { Booking } from '@/types';
import { formatTimeSlot } from '../utils/time-slots';

/**
 * Email template for passenger confirmation
 */
export function passengerConfirmationTemplate(booking: Booking): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f0f9ff;
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(to right, #C41E3A, #0F4C3A);
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .details {
      background: #fef3c7;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      border-left: 4px solid #D4AF37;
    }
    .details h2 {
      margin-top: 0;
      color: #2C2C2C;
      font-size: 20px;
    }
    .detail-row {
      margin: 12px 0;
      line-height: 1.6;
    }
    .detail-label {
      font-weight: bold;
      color: #2C2C2C;
    }
    .important {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .important h3 {
      margin-top: 0;
      color: #92400e;
      font-size: 16px;
    }
    .important ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .important li {
      margin: 8px 0;
      color: #78350f;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      margin-top: 30px;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
    strong { color: #C41E3A; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/festive-rides-logo.png" alt="Festive Rides Logo" style="max-width: 350px; width: 100%; height: auto; margin: 0 auto 20px; display: block; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
      <h1>🎄 Your Festive Ride is Confirmed! 🎅</h1>
    </div>

    <p style="font-size: 16px; line-height: 1.6;">Kia ora <strong>${booking.passenger_name}</strong>,</p>

    <p style="font-size: 16px; line-height: 1.6;">
      Your free community ride has been successfully booked! We're looking forward to helping you get where you need to be this Christmas season.
    </p>

    <div class="details">
      <h2>📋 Booking Details</h2>
      <div class="detail-row">
        <span class="detail-label">Booking Reference:</span> <strong>${booking.booking_reference}</strong>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span> Saturday, December 13, 2025
      </div>
      <div class="detail-row">
        <span class="detail-label">Pickup Time:</span> <strong>${formatTimeSlot(booking.time_slot)}</strong>
      </div>
      <div class="detail-row">
        <span class="detail-label">Pickup Address:</span> ${booking.pickup_address}
      </div>
      <div class="detail-row">
        <span class="detail-label">Destination:</span> ${booking.destination_address}
      </div>
      <div class="detail-row">
        <span class="detail-label">Number of Passengers:</span> ${booking.num_passengers}
      </div>
      ${
        booking.special_requirements
          ? `<div class="detail-row">
               <span class="detail-label">Special Requirements:</span> ${booking.special_requirements}
             </div>`
          : ''
      }
    </div>

    <div class="important">
      <h3>⏰ Important Reminders:</h3>
      <ul>
        <li><strong>Please be ready 5 minutes before your scheduled pickup time</strong></li>
        <li>Save your booking reference: <strong>${booking.booking_reference}</strong></li>
        <li>If you need to cancel, visit: <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cancel" style="color: #C41E3A; font-weight: bold;">Cancel Your Booking</a></li>
        <li>Contact email: <a href="mailto:sammipetersen1720@yahoo.co.nz">sammipetersen1720@yahoo.co.nz</a></li>
      </ul>
    </div>

    <p style="font-size: 16px; line-height: 1.6; text-align: center; color: #0F4C3A;">
      <strong>Meri Kirihimete! 🎄</strong><br>
      Looking forward to seeing you on December 13th!
    </p>

    <div class="footer">
      <p><strong>Festive Rides</strong></p>
      <p>Free Community Transport Service</p>
      <p>the North Shore, Auckland • December 13, 2025</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        This service is provided free of charge as our way of giving back to the community.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Email template for admin notification
 */
export function adminNotificationTemplate(booking: Booking): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h2 {
      color: #C41E3A;
      margin-top: 0;
      font-size: 22px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    td {
      padding: 10px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }
    td:first-child {
      background: #f9fafb;
      font-weight: bold;
      width: 180px;
      color: #374151;
    }
    .booking-ref {
      background: #fef3c7;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #D4AF37;
      margin: 15px 0;
      font-size: 18px;
      font-weight: bold;
      color: #92400e;
    }
    .footer {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/festive-rides-logo.png" alt="Festive Rides Logo" style="max-width: 300px; width: 100%; height: auto; margin: 0 auto 20px; display: block; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
    <h2>🚗 New Festive Ride Booking</h2>

    <div class="booking-ref">
      Booking Reference: ${booking.booking_reference}
    </div>

    <table>
      <tr>
        <td>Passenger Name</td>
        <td><strong>${booking.passenger_name}</strong></td>
      </tr>
      <tr>
        <td>Phone</td>
        <td>${booking.passenger_phone}</td>
      </tr>
      <tr>
        <td>Email</td>
        <td><a href="mailto:${booking.passenger_email}">${booking.passenger_email}</a></td>
      </tr>
      <tr>
        <td>Time Slot</td>
        <td><strong style="color: #C41E3A; font-size: 16px;">${formatTimeSlot(booking.time_slot)}</strong></td>
      </tr>
      <tr>
        <td>Pickup Address</td>
        <td>${booking.pickup_address}</td>
      </tr>
      <tr>
        <td>Destination Category</td>
        <td>${booking.destination_category}</td>
      </tr>
      <tr>
        <td>Destination Address</td>
        <td>${booking.destination_address}</td>
      </tr>
      <tr>
        <td>Number of Passengers</td>
        <td>${booking.num_passengers}</td>
      </tr>
      ${
        booking.special_requirements
          ? `<tr>
               <td>Special Requirements</td>
               <td><strong>${booking.special_requirements}</strong></td>
             </tr>`
          : ''
      }
    </table>

    <div class="footer">
      <p><strong>Booked at:</strong> ${new Date(booking.created_at).toLocaleString('en-NZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}</p>
      <p><strong>Status:</strong> ${booking.status}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
