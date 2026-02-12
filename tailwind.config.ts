import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sighting: '#3B82F6',
        warning: '#F59E0B',
        ticket: '#EF4444',
      },
    },
  },
  plugins: [],
};

export default config;
