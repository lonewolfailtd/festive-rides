'use client';

import { useEffect, useState, useCallback } from 'react';
import { SlotAvailability } from '@/types';

interface UseSlotAvailabilityReturn {
  slots: SlotAvailability | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  totalAvailable: number;
}

export function useSlotAvailability(pollingInterval = 10000): UseSlotAvailabilityReturn {
  const [slots, setSlots] = useState<SlotAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalAvailable, setTotalAvailable] = useState(0);

  const fetchAvailability = useCallback(async () => {
    try {
      const response = await fetch('/api/bookings/check-availability', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch slot availability');
      }

      const data = await response.json();
      setSlots(data.slots);
      setTotalAvailable(data.totalAvailable);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching slot availability:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchAvailability();

    // Set up polling
    const interval = setInterval(fetchAvailability, pollingInterval);

    // Cleanup
    return () => clearInterval(interval);
  }, [fetchAvailability, pollingInterval]);

  return {
    slots,
    isLoading,
    error,
    refresh: fetchAvailability,
    totalAvailable,
  };
}
