'use client';

import { Booking } from '@/types';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface ConfirmationCardProps {
  booking: Booking;
}

const DESTINATION_LABELS: Record<string, string> = {
  'doctor': 'Doctor/Specialist',
  'church': 'Church',
  'supermarket': 'Supermarket',
  'christmas-events': 'Christmas Events',
  'whanau-visits': 'Whanau Visits',
  'other': 'Other',
};

const DESTINATION_ICONS: Record<string, string> = {
  'doctor': '🏥',
  'church': '⛪',
  'supermarket': '🛒',
  'christmas-events': '🎄',
  'whanau-visits': '👨‍👩‍👧‍👦',
  'other': '📍',
};

export function ConfirmationCard({ booking }: ConfirmationCardProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    // Reset after a short delay
    setTimeout(() => setIsPrinting(false), 1000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeSlot = (timeSlot: string) => {
    return timeSlot;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="festive-card">
        {/* Success Icon and Title */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.2,
            type: 'spring',
            stiffness: 200,
            damping: 15,
          }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <svg
              className="w-12 h-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="festive-title text-3xl mb-2">
            Booking Confirmed! 🎉
          </h2>
          <p className="text-festive-charcoal text-lg">
            Your festive ride has been successfully booked
          </p>
        </motion.div>

        {/* Booking Reference */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-festive-red to-festive-green p-6 rounded-lg mb-6 text-center"
        >
          <p className="text-white text-sm font-medium mb-2">
            Booking Reference
          </p>
          <p className="text-white text-4xl font-bold tracking-wider font-mono">
            {booking.booking_reference}
          </p>
        </motion.div>

        {/* Booking Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4 mb-6"
        >
          <h3 className="text-xl font-bold text-festive-charcoal mb-4 flex items-center gap-2">
            <span>📋</span> Booking Details
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Passenger Name */}
            <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-festive-gold">
              <p className="text-sm text-gray-600 mb-1">Passenger Name</p>
              <p className="font-semibold text-festive-charcoal">
                {booking.passenger_name}
              </p>
            </div>

            {/* Phone */}
            <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-festive-gold">
              <p className="text-sm text-gray-600 mb-1">Phone</p>
              <p className="font-semibold text-festive-charcoal">
                {booking.passenger_phone}
              </p>
            </div>

            {/* Email */}
            <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-festive-gold">
              <p className="text-sm text-gray-600 mb-1">Email</p>
              <p className="font-semibold text-festive-charcoal break-all">
                {booking.passenger_email}
              </p>
            </div>

            {/* Number of Passengers */}
            <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-festive-gold">
              <p className="text-sm text-gray-600 mb-1">Passengers</p>
              <p className="font-semibold text-festive-charcoal">
                {booking.num_passengers} {booking.num_passengers === 1 ? 'person' : 'people'}
              </p>
            </div>
          </div>

          {/* Time Slot */}
          <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-festive-green">
            <p className="text-sm text-gray-600 mb-1">📅 Pickup Time</p>
            <p className="font-bold text-festive-charcoal text-lg">
              Saturday, December 13, 2025 • {formatTimeSlot(booking.time_slot)}
            </p>
          </div>

          {/* Pickup Address */}
          <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-festive-red">
            <p className="text-sm text-gray-600 mb-1">📍 Pickup Location</p>
            <p className="font-semibold text-festive-charcoal">
              {booking.pickup_address}
            </p>
          </div>

          {/* Destination */}
          <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-festive-red">
            <p className="text-sm text-gray-600 mb-1">
              {DESTINATION_ICONS[booking.destination_category]} Destination
            </p>
            <p className="font-semibold text-festive-charcoal mb-1">
              {DESTINATION_LABELS[booking.destination_category]}
            </p>
            <p className="text-festive-charcoal">
              {booking.destination_address}
            </p>
          </div>

          {/* Special Requirements */}
          {booking.special_requirements && (
            <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-festive-gold">
              <p className="text-sm text-gray-600 mb-1">💬 Special Requirements</p>
              <p className="text-festive-charcoal">
                {booking.special_requirements}
              </p>
            </div>
          )}

          {/* Booking Created */}
          <div className="bg-festive-cream p-4 rounded-lg border-l-4 border-gray-400">
            <p className="text-sm text-gray-600 mb-1">Booked On</p>
            <p className="text-festive-charcoal">
              {formatDate(booking.created_at)}
            </p>
          </div>
        </motion.div>

        {/* Important Reminders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6"
        >
          <h3 className="text-lg font-bold text-festive-charcoal mb-4 flex items-center gap-2">
            <span>⚠️</span> Important Reminders
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">⏰</span>
              <p className="text-festive-charcoal">
                <strong>Be ready 5 minutes early</strong> - Our driver will arrive at your pickup location at the scheduled time.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">💾</span>
              <p className="text-festive-charcoal">
                <strong>Save your booking reference:</strong> {booking.booking_reference}. You may need this for your records.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">📧</span>
              <p className="text-festive-charcoal">
                <strong>Check your email</strong> - A confirmation has been sent to {booking.passenger_email}
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">📞</span>
              <p className="text-festive-charcoal">
                <strong>Need help?</strong> Contact us at{' '}
                <a
                  href="mailto:sammipetersen1720@yahoo.co.nz"
                  className="text-festive-red hover:underline font-semibold"
                >
                  sammipetersen1720@yahoo.co.nz
                </a>
              </p>
            </li>
          </ul>
        </motion.div>

        {/* Print Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center print:hidden"
        >
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="festive-button-primary inline-flex items-center justify-center gap-2 w-full md:w-auto md:px-8"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            {isPrinting ? 'Printing...' : 'Print Confirmation'}
          </button>
          <p className="text-sm text-gray-600 mt-3">
            Perfect for keeping a physical copy of your booking
          </p>
        </motion.div>

        {/* Cancel Booking Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center print:hidden border-t border-gray-200 pt-6 mt-6"
        >
          <p className="text-sm text-gray-600 mb-3">
            Need to cancel your booking?
          </p>
          <a
            href="/cancel"
            className="text-festive-red hover:text-festive-burgundy transition-colors text-sm font-semibold underline"
          >
            Cancel This Booking
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}
