import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { TIME_SLOTS } from '@/lib/utils/time-slots';
import { SlotAvailability } from '@/types';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Fetch all confirmed bookings
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('time_slot')
      .eq('status', 'confirmed');

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch availability',
        },
        { status: 500 }
      );
    }

    // Create a set of booked time slots for fast lookup
    const bookedSlots = new Set((bookings || []).map((b) => b.time_slot));

    // Build availability object
    const slots: SlotAvailability = {};
    let totalAvailable = 0;

    TIME_SLOTS.forEach((slot) => {
      const isBooked = bookedSlots.has(slot.time);
      slots[slot.time] = {
        available: !isBooked,
        booked: isBooked,
      };

      if (!isBooked) {
        totalAvailable++;
      }
    });

    return NextResponse.json({
      slots,
      totalAvailable,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Availability check error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

// Enable runtime edge for faster responses
export const runtime = 'edge';
