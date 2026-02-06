import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: 'pdf-worker'
        }
      ]
    })
  ],
  assetsInclude: ['**/*.wasm'], 
  optimizeDeps: {
    exclude: ['onnxruntime-web', 'phonemizer']
  },
  worker: {
    format: 'es',
    plugins: () => [react()]
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})