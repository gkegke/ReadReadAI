import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Vite 6 Configuration for Offline AI Studio.
 * Updated for compatibility with vite-plugin-pwa v0.21+
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Using 'prompt' allows us to use our custom "New Update Available" toast
      // defined in main.tsx, respecting Human-First feedback principles.
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        // AI assets are large. We cache them aggressively but carefully.
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // Upped to 20MB for v6 robustness
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // We explicitly ignore heavy model binaries from the main bundle
        // to prevent slow initial PWA install. They are handled by runtimeCaching.
        globIgnores: ['**/node_modules/**/*', '**/*audio-processor*', '**/*.wasm', '**/*.onnx', '**/*.bin'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:onnx|wasm|bin|json)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'readread-ai-assets-v3',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 Days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'ReadRead Studio',
        short_name: 'ReadRead',
        description: 'Offline AI Text-to-Speech Studio',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    }),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs', dest: 'pdf-worker' },
        { src: 'node_modules/onnxruntime-web/dist/*.wasm', dest: 'onnx-runtime' },
        { src: 'node_modules/onnxruntime-web/dist/*.mjs', dest: 'onnx-runtime' }
      ]
    })
  ],

  worker: {
    format: 'es',
    plugins: () => [react()]
  },

  define: {
    'process.env.NODE_DEBUG': undefined,
    'global.module': undefined
  },

  assetsInclude: ['**/*.wasm', '**/*.onnx', '**/*.bin'],

  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },

  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-utils': ['lucide-react', 'clsx', 'tailwind-merge'],
          'ai-core': ['onnxruntime-web', 'comlink']
        }
      }
    }
  }
})
