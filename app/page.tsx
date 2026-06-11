import { redirect } from 'next/navigation';

// The home page IS June's Library now. The old Festive Rides booking page
// lives on at /rides (the Dec 2025 event has ended).
export default function HomePage() {
  redirect('/surprise');
}
