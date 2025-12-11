# Festive Rides - Free Community Transport

A festive-themed booking system for free community transport services in North Auckland on December 13, 2025. Built with Next.js 15, Supabase, and Resend.

## Features

- **Festive Design**: Beautiful Christmas-themed UI with snowfall animations, festive colors, and custom Google Fonts (Mountains of Christmas & Poppins)
- **Real-time Booking**: Live availability updates using Supabase
- **Time Slot Management**: 30-minute booking slots from 10:00 AM to 10:00 PM
- **Email Notifications**: Automated confirmation emails via Resend
- **Booking Confirmations**: Unique booking IDs with QR code support
- **Admin Dashboard**: Manage bookings and view all reservations
- **Mobile Responsive**: Works seamlessly on all devices
- **Form Validation**: Client and server-side validation with Zod
- **Toast Notifications**: User-friendly feedback with Sonner

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Email Service**: Resend
- **Styling**: Tailwind CSS with custom festive theme
- **Fonts**: Google Fonts (Mountains of Christmas, Poppins)
- **Forms**: React Hook Form with Zod validation
- **Animations**: Framer Motion
- **TypeScript**: Full type safety

## Prerequisites

Before you begin, ensure you have:

- Node.js 18.17 or later installed
- A Supabase account (free tier works)
- A Resend account for email sending
- npm or yarn package manager

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd C:\Users\lonewolf\festive-rides
npm install
```

### 2. Configure Environment Variables

Copy the `.env.local` file and update it with your actual credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Resend Email API
RESEND_API_KEY=your_resend_api_key

# Admin Configuration
ADMIN_EMAIL=sammipetersen1720@yahoo.co.nz

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Getting your credentials:**

- **Supabase**: Go to your [Supabase Dashboard](https://supabase.com/dashboard) → Select your project → Settings → API
  - Copy the `Project URL` for `NEXT_PUBLIC_SUPABASE_URL`
  - Copy the `anon public` key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Copy the `service_role` key for `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

- **Resend**: Go to [Resend API Keys](https://resend.com/api-keys) → Create API Key
  - Copy the API key for `RESEND_API_KEY`

### 3. Set Up Supabase Database

Run the migration script to create the required database tables:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Create a new query
5. Copy and paste the contents of `supabase-migration.sql`
6. Click **Run** to execute the migration

This will create:
- `bookings` table with all necessary columns
- Row Level Security (RLS) policies
- Indexes for performance

### 4. Configure Resend Email Domain

1. Go to [Resend Domains](https://resend.com/domains)
2. Add and verify your domain (or use Resend's testing domain for development)
3. Update the email sending code if needed to use your verified domain

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

```
festive-rides/
├── app/
│   ├── api/
│   │   └── bookings/        # API routes for booking management
│   ├── confirmation/         # Booking confirmation page
│   ├── globals.css          # Global styles and festive theme
│   └── layout.tsx           # Root layout with metadata
├── components/
│   ├── BookingForm.tsx      # Main booking form component
│   └── Snowfall.tsx         # Festive snowfall animation
├── hooks/
│   └── useBookingForm.ts    # Form logic and validation
├── lib/
│   ├── supabase.ts          # Supabase client configuration
│   └── utils.ts             # Utility functions
├── types/
│   └── booking.ts           # TypeScript type definitions
├── public/                   # Static assets
├── supabase-migration.sql   # Database schema
├── .env.local               # Environment variables (not committed)
└── package.json             # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and import your repository
3. Configure environment variables in Vercel:
   - Add all variables from `.env.local`
   - Update `NEXT_PUBLIC_APP_URL` to your production URL
4. Deploy!

### Important Deployment Notes

- Update `NEXT_PUBLIC_APP_URL` to your production domain
- Ensure Supabase RLS policies are properly configured
- Verify your Resend domain is set up for production emails
- Update metadata base URL in `app/layout.tsx` if needed

## Configuration

### Time Slots

Time slots are configured in 30-minute intervals from 10:00 AM to 10:00 PM on December 13, 2025. To modify:

1. Edit the time slot generation logic in the booking API
2. Update validation schema in `types/booking.ts`

### Email Templates

Email templates are located in the booking API route. Customize the HTML to match your branding.

### Festive Theme

Colors and styling are defined in:
- `tailwind.config.ts` - Tailwind theme colors
- `app/globals.css` - Custom CSS classes and animations

## Support

For issues or questions:
- Email: sammipetersen1720@yahoo.co.nz

## License

This project is for community use. Feel free to adapt it for your own community transport needs!

---

Built with love for the North Auckland community. Have a festive and safe holiday season!
