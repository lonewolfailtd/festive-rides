import type { Metadata } from 'next'
import { Mountains_of_Christmas, Poppins } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

// Configure Google Fonts. adjustFontFallback: false suppresses Next's
// "Failed to find font override values" warning — Mountains of Christmas
// isn't in Next's font-metrics database so the auto-fallback can't be
// computed. We don't need it.
const mountainsOfChristmas = Mountains_of_Christmas({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mountains',
  display: 'swap',
  adjustFontFallback: false,
})

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

// Metadata configuration
export const metadata: Metadata = {
  title: 'Festive Rides - Free Community Transport | the North Shore, Auckland',
  description: 'Book your free festive ride on December 13, 2025. Community transport service for the North Shore, Auckland.',
  metadataBase: new URL('http://localhost:3000'),
  openGraph: {
    title: 'Festive Rides - Free Community Transport',
    description: 'Book your free festive ride on December 13, 2025. Community transport service for the North Shore, Auckland.',
    type: 'website',
    locale: 'en_NZ',
    siteName: 'Festive Rides',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Festive Rides - Free Community Transport',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Festive Rides - Free Community Transport',
    description: 'Book your free festive ride on December 13, 2025. Community transport service for the North Shore, Auckland.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-NZ" className={`${mountainsOfChristmas.variable} ${poppins.variable}`}>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          duration={3500}
          toastOptions={{
            style: {
              fontFamily: 'var(--font-poppins), sans-serif',
              fontSize: '0.875rem',
            },
            className: 'shadow-lg',
          }}
        />
      </body>
    </html>
  )
}
