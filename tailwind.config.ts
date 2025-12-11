import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
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
