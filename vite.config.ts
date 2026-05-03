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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Pinova',
        short_name: 'Pinova',
        description: 'Pinova - Votre source d\'inspiration visuelle',
        theme_color: '#ffffff',
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
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,vue}'],
        globIgnores: ['**/assets/group*-shard*.js'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Pas de runtime cache des réponses API (données souvent authentifiées).
      }
    })
  ],
  build: {
    outDir: 'dist'
  }
})
