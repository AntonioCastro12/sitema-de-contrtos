import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['rcm-logo.jpg', 'icon.svg'],
      manifest: {
        name: 'RCM CodeDev - Cierres en Campo',
        short_name: 'RCM Cierres',
        description: 'PWA Offline-First para levantamiento de requerimientos, firma digital y contratos PDF en campo de RCM CodeDev.',
        theme_color: '#1E3A5F',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'rcm-logo.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'rcm-logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        navigateFallbackDenylist: [/^\/\.netlify/, /^\/api/],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB para incluir pdfmake + vfs_fonts completos en precache
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ]
})
