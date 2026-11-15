// Tailwind derleme sırasında üretilir (eskiden tarayıcıda cdn.tailwindcss.com ile üretiliyordu)
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './shared/**/*.ts'],
  // phoneland: yan çevrilmiş telefon (Süre sekmesi tam ekran olur)
  theme: { extend: { screens: { xs: '400px', phoneland: { raw: '(orientation: landscape) and (max-height: 540px)' } } } },
  plugins: [],
};
