import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // The service worker downloads everything it precaches in the background on
        // the first visit, competing with the page itself on slow mobile data. Keep
        // the app shell precached, but leave the large, rarely-needed lazy chunks
        // (3D background, error reporting, leadership dashboards) to load on demand.
        globIgnores: [
          '**/Interactive3DCanvas-*.js',
          '**/sentry-*.js',
          '**/BishopPage-*.js',
          '**/AdminPage-*.js',
        ],
      },
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        name: 'UNSTPBL — Daily Verse',
        short_name: 'UNSTPBL',
        description: 'Your daily Bible verse, delivered with purpose.',
        theme_color: '#0b0f13',
        background_color: '#0b0f13',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          sentry: ['@sentry/react'],
          // recharts is deliberately NOT a manual chunk. As one, Rollup made the
          // entry bundle depend on it, so every visitor (even on the login screen)
          // downloaded ~380 kB of charts that only the Bishop page uses. Left alone
          // it stays inside that page's own lazy chunk.
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
