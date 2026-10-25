// Tailwind derleme sırasında üretilir (eskiden tarayıcıda cdn.tailwindcss.com ile üretiliyordu)
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './shared/**/*.ts'],
  theme: { extend: {} },
  plugins: [],
};
