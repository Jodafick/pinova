import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'logo.png',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'apple-touch-icon-120x120.png',
        'apple-touch-icon-152x152.png',
        'apple-touch-icon-167x167.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'mask-icon.svg',
        'vite.svg'
      ],
      manifest: {
        id: '/',
        name: 'Pinova',
        short_name: 'Pinova',
        description: "Pinova — votre source d'inspiration visuelle",
        lang: 'fr',
        dir: 'ltr',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'browser'],
        orientation: 'portrait-primary',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        categories: ['photo', 'social', 'lifestyle'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        /* Raccourcis OS (long-press icône Android, future iOS 17+). */
        shortcuts: [
          {
            name: 'Créer un pin',
            short_name: 'Créer',
            description: 'Publier un nouveau contenu sur Pinova',
            url: '/create?source=shortcut',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Explorer',
            short_name: 'Explorer',
            description: 'Découvrir de nouveaux pins',
            url: '/explore?source=shortcut',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Story',
            short_name: 'Story',
            description: 'Créer une nouvelle story',
            url: '/story/create?source=shortcut',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Notifications',
            short_name: 'Notifs',
            description: 'Voir mes notifications',
            url: '/notifications?source=shortcut',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ],
        /* Share Target API — recevoir un partage du système. */
        share_target: {
          action: '/create',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'description',
            url: 'link',
            files: [
              { name: 'media', accept: ['image/*', 'video/*'] }
            ]
          }
        },
        /* Capacités UA (Edge / Chrome). */
        edge_side_panel: { preferred_width: 480 },
        prefer_related_applications: false
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,vue}'],
        globIgnores: ['**/assets/group*-shard*.js'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        /* Runtime cache — important pour le perceived offline-first.
           On évite STRICTEMENT les endpoints qui retournent du contenu
           authentifié sans Cache-Control headers (auth, tokens, etc.). */
        runtimeCaching: [
          /* Images Pinova : stale-while-revalidate (retour cache instant). */
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pinova-images',
              expiration: {
                maxEntries: 240,
                maxAgeSeconds: 30 * 24 * 3600
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          /* Fonts Google : cache-first long-lived. */
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pinova-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 90 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          /* Topics / méta-données publiques (non sensibles). */
          {
            urlPattern: /\/api\/.+\/(topics|trending|public)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pinova-public-api',
              expiration: { maxEntries: 30, maxAgeSeconds: 1 * 3600 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist'
  }
})
