import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Custom plugin to inject "built by scout" tag
function injectBuiltByScoutPlugin() {
  return {
    name: 'inject-built-by-scout',
    transformIndexHtml(html: string) {
      // Inject the scout tag script reference
      const scriptTag = '<script defer src="/scout-tag.js"></script>';
      
      // Inject the script before the closing body tag
      return html.replace('</body>', scriptTag + '\n  </body>');
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(), 
    injectBuiltByScoutPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Notention',
        short_name: 'Notention',
        description: 'A lightweight, client-side Progressive Web App for decentralized note-taking and network matching with semantic structure and Nostr integration.',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
      src: 'pwa-192x192.png', // Assumed to exist in public/
            sizes: '192x192',
      type: 'image/png'
          },
          {
      src: 'pwa-512x512.png', // Assumed to exist in public/
            sizes: '512x512',
      type: 'image/png'
    },
    {
      src: 'pwa-maskable-512x512.png', // Assumed to exist in public/ for maskable icon
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Nostr relay communications (WebSocket connections cannot be cached directly by SW,
            // but any HTTP/HTTPS fallbacks or API endpoints related to Nostr could be.
            // For actual WebSocket data, offline handling needs to be in app logic.
            // This entry is a placeholder in case any part of Nostr interaction uses HTTP.
            urlPattern: /^https:\/\/relay\.damus\.io\//, // Example, adjust to actual relay URLs or a more generic pattern
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nostr-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 24 * 60 * 60, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Example for caching other API calls if any (e.g., if AI services were cloud-based)
            urlPattern: /^https:\/\/api\.example\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 6 * 60 * 60, // 6 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Add more runtime caching rules as needed
        ],
        navigateFallback: '/index.html', // Good for SPAs
        cleanupOutdatedCaches: true, // Recommended
        // Background sync for HTTP POST/PUT requests can be configured here if needed
        // For WebSocket (Nostr), app-level queuing is required.
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
