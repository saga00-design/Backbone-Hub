import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const FIREBASE_DOMAINS = [
  /^https:\/\/firestore\.googleapis\.com\/.*/,
  /^https:\/\/.*\.firebaseio\.com\/.*/,
  /^https:\/\/identitytoolkit\.googleapis\.com\/.*/,
  /^https:\/\/.*\.googleapis\.com\/.*/,
];

export default defineConfig({
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY)
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Backbone HUB',
        short_name: 'Backbone Hub',
        description: 'Restaurant management hub for Backbone',
        theme_color: '#0D6EFD',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB — main bundle exceeds 2 MB default
        navigateFallbackDenylist: FIREBASE_DOMAINS,
        runtimeCaching: [
          // Firebase / Google APIs — always network only, never intercepted
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/,
            handler: 'NetworkOnly',
          },
          // Static assets — cache first with long TTL
          {
            urlPattern: /\.(?:js|css|png|svg|woff|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Dev is localhost-only. Vite always allows `localhost` and bare IP hosts
    // (127.0.0.1, LAN 192.168.x.x / 10.x.x.x) regardless of this list, so an
    // empty array covers real usage while still rejecting a spoofed Host
    // header from an arbitrary domain. Was `true` (accept any host) purely as
    // a leftover from the original AI Studio scaffold — not actually needed.
    allowedHosts: []
    // hmr intentionally left on Vite's default auto-detection - it infers
    // the correct protocol/port from how the page was actually loaded.
    // A hardcoded { protocol: 'wss', clientPort: 443 } here previously
    // forced every local dev session (plain http on :3000) to try
    // reconnecting over wss on :443, which always failed and caused
    // constant "server connection lost" / ERR_CONNECTION_REFUSED noise.
  }
});
