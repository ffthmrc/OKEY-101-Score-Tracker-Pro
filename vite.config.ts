import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Uygulama Oracle sunucusunda kökten (/) sunulur. Gemini anahtarı artık pakete gömülmez (server/gemini.ts).
const API_TARGET = process.env.OKEY_SERVER ?? 'http://localhost:8080';

export default defineConfig({
  base: '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/ws': { target: API_TARGET, ws: true },
      '/api': API_TARGET,
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
