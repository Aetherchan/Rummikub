/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'tile-red': '#dc2626',
        'tile-blue': '#2563eb',
        'tile-yellow': '#facc15',
        'tile-black': '#1e293b',
        'table-green': '#166534',
        'table-felt': '#1a6b3c',
      },
    },
  },
  plugins: [],
};
