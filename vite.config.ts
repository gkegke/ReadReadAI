import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * [CRITICAL: PRODUCTION BUILD FIX]
 * Vite 6 Configuration for Offline AI Studio.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // Increased to 15MB for heavy AI bundles
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['**/node_modules/**/*', '**/*audio-processor*', '**/*.wasm', '**/*.onnx', '**/*.bin'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:onnx|wasm|bin|json)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'readread-ai-assets-v2',
              expiration: { 
                maxEntries: 100, 
                maxAgeSeconds: 60 * 60 * 24 * 90 
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

  // [FIX: IIFE WORKER ERROR] 
  // Code-splitting builds (production) require workers to be in 'es' format.
  worker: {
    format: 'es',
    plugins: () => [react()]
  },

  define: {
    // [FIX: ESPEAK-NG COMPAT] 
    // Shims the 'module' reference often found in Emscripten-generated wrappers 
    // to prevent Vite from trying to externalize Node.js internals.
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