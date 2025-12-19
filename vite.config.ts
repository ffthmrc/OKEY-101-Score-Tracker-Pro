import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    // ✅ base path (important for PWA offline)
    base: '/',

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [
      react(),

      // ✅ PWA / Offline support
      VitePWA({
        registerType: 'autoUpdate',

        // ✅ force all assets to be available offline
        includeAssets: ['**/*'],

        manifest: {
          name: 'OKEY 101 Tracker',
          short_name: 'OKEY 101',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ffffff',
          icons: [
            {
              src: '/pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },

        workbox: {
          // ✅ cache EVERYTHING needed for UI (JS + CSS + images)
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],

          // ✅ critical for offline navigation & styling
          navigateFallback: '/index.html',
        },
      }),
    ],

    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
