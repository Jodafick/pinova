import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const sharedAlias = path.resolve(__dirname, 'src/shared/index.ts')

const sentryRelease = process.env.VITE_SENTRY_RELEASE || process.env.SENTRY_RELEASE || ''
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || ''

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const useLocalApiProxy = mode === 'e2e' || process.env.VITE_E2E_LOCAL_API === 'true'
  return {
  server: useLocalApiProxy
    ? {
        port: 5175,
        proxy: {
          '/api': {
            target: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
            changeOrigin: true,
          },
        },
      }
    : undefined,
  resolve: {
    alias: {
      '@fotoce/shared': sharedAlias,
    },
  },
  plugins: [
    vue(),
    tailwindcss(),
    ...(sentryAuthToken && sentryRelease
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG || 'fotoce',
            project: process.env.SENTRY_PROJECT_WEB || 'fotoce-web',
            authToken: sentryAuthToken,
            release: { name: sentryRelease },
            sourcemaps: {
              assets: './dist/**',
            },
            telemetry: false,
          }),
        ]
      : []),
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
        name: 'Fotoce',
        short_name: 'Fotoce',
        description: "Fotoce — votre source d'inspiration visuelle",
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
            name: 'Créer une Foto',
            short_name: 'Créer',
            description: 'Publier un nouveau contenu sur Fotoce',
            url: '/create?source=shortcut',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Explorer',
            short_name: 'Explorer',
            description: 'Découvrir de nouvelles Fotos',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: [
          '**/assets/group*-shard*.js',
          '**/assets/vendor-tfjs*.js',
          '**/assets/vendor-icons*.css',
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        /* Runtime cache — important pour le perceived offline-first.
           On évite STRICTEMENT les endpoints qui retournent du contenu
           authentifié sans Cache-Control headers (auth, tokens, etc.). */
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              /\/media\//i.test(url.pathname) ||
              /\/pins\/.+\/(image|video|thumbnail)/i.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fotoce-api-media',
              expiration: {
                maxEntries: 72,
                maxAgeSeconds: 3 * 24 * 3600,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          /* Images Fotoce : stale-while-revalidate (retour cache instant). */
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fotoce-images',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 14 * 24 * 3600
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          /* Fonts Google : cache-first long-lived. */
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fotoce-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 90 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          /* Topics / méta-données publiques (non sensibles). */
          {
            urlPattern: /\/api\/.+\/(topics|trending|public)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fotoce-public-api',
              expiration: { maxEntries: 30, maxAgeSeconds: 1 * 3600 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@fortawesome')) return 'vendor-icons'
          if (id.includes('@tensorflow') || id.includes('nsfwjs')) {
            return 'vendor-tfjs'
          }
          if (
            id.includes('/vue/') ||
            id.includes('/vue-router/') ||
            id.includes('/@vue/') ||
            id.includes('/pinia/')
          ) {
            return 'vendor-vue'
          }
        },
      },
    },
  },
  }
})
