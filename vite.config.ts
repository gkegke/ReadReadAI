import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 250 * 1024 * 1024, 
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        // [CRITICAL FIX] Prevent PWA from mangling AudioWorklets. 
        // Service Worker interception often breaks Worklet CORS & MIME type mapping
        globIgnores: ['**/node_modules/**/*', '**/*audio-processor*.js', '**/*audio-processor*.ts'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:onnx|wasm|bin|json)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'readread-ai-assets',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'ReadRead Studio',
        short_name: 'ReadRead',
        description: 'Zero-Cloud Browser TTS Studio',
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
      }
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: 'pdf-worker'
        }
      ]
    })
  ],
  assetsInclude: ['**/*.wasm', '**/*.data'],
  optimizeDeps: {
    exclude: ['onnxruntime-web', 'kokoro-js', 'espeak-ng']
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es'
  }
})