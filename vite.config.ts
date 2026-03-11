import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '旅暦',
        short_name: '旅暦',
        description: '複数人で共同編集できる旅程アプリ',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // workbox-build 7.4.0 が外部 runtime 分割時に Rollup へ不正な
        // manualChunks オプションを渡し警告を出すため、runtime を SW に内包する。
        inlineWorkboxRuntime: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // 認証エンドポイント (/auth/v1/) は絶対にキャッシュしない
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/(?!auth\/v1\/).+/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
})
