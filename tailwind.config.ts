import type { Config } from "tailwindcss";

// `sky` is overridden to read from CSS variables so the entire uni section
// can be themed by flipping a `data-theme` attribute on the <html> element.
// The variables are defined in app/globals.css for each named palette.
// Festive Rides booking pages don't use the sky family so they're unaffected.
const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          50: 'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
          950: 'rgb(var(--accent-950) / <alpha-value>)',
        },
        festive: {
          red: '#C41E3A',
          green: '#0F4C3A',
          gold: '#D4AF37',
          cream: '#FAF9F6',
          charcoal: '#2C2C2C',
        },
      },
      fontFamily: {
        festive: ['"Mountains of Christmas"', 'cursive'],
        body: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
